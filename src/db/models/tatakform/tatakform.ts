import { ErrorTypes } from "../../../types/enums";
import { TatakformModel } from "../../../types/models";
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { getReadableDate } from "../../../utils/date";
import { join } from "path";

import TatakFormAttendance from "./attendance";
import TatakFormStudent from "./student";
import Log from "../../../utils/log";
import College from "../college";
import Database from "../..";

/**
 * TatakForm model
 * This model represents the tatakforms table in the database
 * @author mavyfaby (Maverick G. Fabroa)
 */
class Tatakform {
  /**
   * Get all courses
   */
  public static getAll(): Promise<TatakformModel[]> {
    return new Promise(async (resolve, reject) => {
      // Get database instance
      const db = Database.getInstance();

      try {
        // Get all courses
        const result = await db.query<TatakformModel[]>(
          `SELECT * FROM tatakforms ORDER BY from_date DESC`
        );

        // If no results
        if (result.length === 0) {
          Log.e("No tatakforms found");
          return reject("No tatakforms found");
        }

        // Return tatakforms list
        resolve(result);
      }

      // Log error and reject promise
      catch (e) {
        Log.e(e);
        reject(ErrorTypes.DB_ERROR);
      }
    });
  }

  /**
   * Get by slug name
   */
  public static getBySlug(slug: string): Promise<TatakformModel> {
    return new Promise(async (resolve, reject) => {
      // Get database instance
      const db = Database.getInstance();

      try {
        // Get tatakform by slug
        const result = await db.query<TatakformModel[]>(
          `SELECT * FROM tatakforms WHERE slug = ?`, [slug]
        );

        // If no results
        if (result.length === 0) {
          Log.e("No tatakform found");
          return reject("No tatakform found");
        }

        // Return tatakform
        resolve(result[0]);
      }

      // Log error and reject promise
      catch (e) {
        Log.e(e);
      }
    });
  }

  /**
   * Generate Tatakform PDF
   */
  public static generatePDF(studentId: string, slug: string): Promise<File> {
    return new Promise(async (resolve, reject) => {
      // Get event by slug
      const tatakform = await Tatakform.getBySlug(slug);
      // Get student
      const student = await TatakFormStudent.getByStudentId(studentId);
      // Get attendance history by event
      const attendance = await TatakFormAttendance.getAttendanceByEvent(studentId, tatakform.id);
      // Get college
      const college = await College.getByCourseId(student.course_id);

      try {
        // Get tatakform template pdf file
        const template = Bun.file(join(Bun.main, `../../assets/tatakform/${slug}.pdf`));
        // Get logo file
        const logoFile = Bun.file(join(Bun.main, `../../assets/tatakform/colleges/${college.acronym.toLowerCase()}.png`));
        // Load pdf
        const pdf = await PDFDocument.load(await template.arrayBuffer(), { updateMetadata: false });
        // Load logo
        const logo = await pdf.embedPng(await logoFile.arrayBuffer());
        // Font
        const font = await pdf.embedFont(StandardFonts.Courier);
        // Get first page
        const page = pdf.getPages()[0];

        // Set metadata
        pdf.setTitle(`Tatakform - ${college.acronym} - ${student.first_name} ${student.last_name} - ${studentId}`);
        pdf.setAuthor("UC Main CSP-S");
        pdf.setCreationDate(new Date());
        pdf.setModificationDate(new Date());
        pdf.setSubject(slug);

        // Full name
        page.drawText(`${student.first_name} ${student.last_name}`, {
          x: 205, y: page.getHeight() - 365, size: 28, font
        });

        // Course and year
        page.drawText(`${college.courses?.[0].acronym} - ${student.year_level}`, {
          x: 1420, y: page.getHeight() - 365, size: 28, font
        });
        
        // Date
        page.drawText(getReadableDate(new Date()), {
          x: 205, y: page.getHeight() - 416, size: 28, font
        });

        // Department
        page.drawText(college.name, {
          x: 1305, y: page.getHeight() - 416, size: 28, font
        });

        // Note
        page.drawText("This tatakform was generated at https://ucmncsps.org/tatakforms", {
          x: 170, y: 80, size: 20, font
        });

        // TODO: Make this more dynamic
        if (attendance !== null) {
          // Day 1 AM
          if (attendance.day1_am) {
            page.drawImage(logo, {
              x: 250,
              y: page.getHeight() - 790,
              width: 250, 
              height: 250,
              opacity: 0.7
            });
          }

          // Day 1 PM
          if (attendance.day1_pm) {
            page.drawImage(logo, {
              x: 250,
              y: page.getHeight() - 1090,
              width: 250, 
              height: 250,
              opacity: 0.7
            });
          }

          // Day 2 AM
          if (attendance.day2_am) {
            page.drawImage(logo, {
              x: 875,
              y: page.getHeight() - 790,
              width: 250, 
              height: 250,
              opacity: 0.7
            });
          }

          // Day 2 PM
          if (attendance.day2_pm) {
            page.drawImage(logo, {
              x: 875,
              y: page.getHeight() - 1090,
              width: 250, 
              height: 250,
              opacity: 0.7
            });
          }

          // Day 3 AM
          if (attendance.day3_am) {
            page.drawImage(logo, {
              x: 1525,
              y: page.getHeight() - 790,
              width: 250, 
              height: 250,
              opacity: 0.7
            });
          }
          
          // Day 3 PM
          if (attendance.day3_pm) {
            page.drawImage(logo, {
              x: 1525,
              y: page.getHeight() - 1090,
              width: 250, 
              height: 250,
              opacity: 0.7
            });
          }
        }

        // Save PDF
        const buffer = await pdf.save();
        // Log download
        Log.i(`💙 [Tatakform] [DOWNLOAD] [${slug.toUpperCase()}] – ${student.first_name} ${student.last_name} (${student.student_id})`);
        // Resolve promise
        resolve(new File([buffer], `tatakform_${college.acronym.toLowerCase()}_${studentId}.pdf`, { type: "application/pdf" }));
      }
      
      // Log error
      catch (error) {
        Log.e(error);
        reject(error);
      }
    });
  }
}

export default Tatakform;