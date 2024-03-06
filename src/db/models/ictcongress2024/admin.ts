import { join } from "path";
import { EmailType, ErrorTypes } from "../../../types/enums";
import { PaginationOutput } from "../../../types/request";
import { isEmail, isObjectEmpty } from "../../../utils/string";
import { paginationWrapper } from "../../../utils/pagination";
import { MariaUpdateResult } from "../../../types";
import { getDatestamp, getReadableDate } from "../../../utils/date";
import { sendEmail } from "../../../utils/email";
import { generateICTCongressReference } from "../../../utils/security";
import Strings from "../../../config/strings";
import Log from "../../../utils/log";
import Database from "../..";

import {
  ICTCampus, ICTCourse, ICTDiscountCode, ICTShirtSize,
  ICTStatistics, ICTStudentModel, ICTStudentRegisterModel
} from "../../../types/models";

import XLSXTemplate from 'xlsx-template';

type AdminData = {
  campus: string;
  campus_id: number;
  campus_name: string;
  username: string;
  password: string;
};

/**
 * ICT Congress Admin Model
 * @author mavyfaby (Maverick G. Fabroa)
 */
class Admin {
  /**
   * Get by username and password
   */
  public static getByUsernameAndPassword(username: string, password: string): Promise<AdminData> {
    return new Promise(async (resolve, reject) => {
      // Get database instance
      const db = Database.getInstance();

      try {
        // Get admin by username and password
        const result = await db.query<AdminData[]>(
          "SELECT c.campus, c.campus_name, s.* FROM ict2024_accounts s INNER JOIN ict2024_campus c ON s.campus_id = c.id WHERE s.username = ? LIMIT 1", [username]
        );

        if (result.length === 0) {
          return reject(ErrorTypes.DB_EMPTY_RESULT);
        }

        // If password is incorrect
        if (!(await Bun.password.verify(password, result[0].password || ""))) {
          return reject(ErrorTypes.UNAUTHORIZED);
        }

        resolve(result[0]);
      }

      // Log error and reject promise
      catch (e) {
        Log.e(e);
        reject(ErrorTypes.DB_ERROR);
      }
    });
  }

  /**
   * Get by username
   */
  public static getByUsername(username: string): Promise<AdminData> {
    return new Promise(async (resolve, reject) => {
      // Get database instance
      const db = Database.getInstance();

      try {
        // Get admin by username
        const result = await db.query<AdminData[]>(
          "SELECT c.campus, c.campus_name, s.* FROM ict2024_accounts s INNER JOIN ict2024_campus c ON c.id = s.campus_id WHERE s.username = ? LIMIT 1", [
          username
        ]
        );

        if (result.length === 0) {
          return reject(ErrorTypes.DB_EMPTY_RESULT);
        }

        resolve(result[0]);
      }

      // Log error and reject promise
      catch (e) {
        Log.e(e);
        reject(ErrorTypes.DB_ERROR);
      }
    });
  }

  /**
   * Get student by RFID
   * @param rfid Student's RFID
   */
  public static getStudentByRFID(rfid: string): Promise<ICTStudentModel> {
    return new Promise(async (resolve, reject) => {
      const db = Database.getInstance();

      try {
        // Get student by RFID
        const result = await db.query<ICTStudentModel[]>(
          "SELECT * FROM ict2024_students WHERE rfid = ? LIMIT 1", [rfid]
        );

        if (result.length === 0) {
          return reject("Student not found.");
        }

        resolve(result[0]);
      }

      // Log error and reject promise
      catch (e) {
        Log.e(e);
        reject("Error retrieving student.");
      }
    });
  }

  /**
   * Search
   * @param campus_id Campus
   * @param search Search
   */
  public static searchStudents(campus_id: number, pagination?: PaginationOutput): Promise<[ICTStudentModel[], count: number]> {
    return new Promise(async (resolve, reject) => {
      // Get database instance
      const db = Database.getInstance();

      try {
        // Get pagination
        if (pagination && !isObjectEmpty(pagination)) {
          const { query, countQuery, values, countValues, search, filter, filterLogic } = paginationWrapper(db, {
            query: `
              SELECT s.*, ts.name as tshirt_size, c.course_name as course FROM ict2024_students s
              INNER JOIN ict2024_tshirt_sizes ts ON s.tshirt_size_id = ts.id
              INNER JOIN ict2024_courses c ON s.course_id = c.id
              WHERE s.campus_id = ${db.escape(campus_id)}
            `,
            request: pagination
          });

          // Get students
          const students = await db.query<ICTStudentModel[]>(query, values);
          const count = await db.query<[{ count: bigint }]>(countQuery, countValues);

          // If no students found
          if (students.length === 0) {
            return reject(`No students found${search ? " for " + search : ""}${filter !== "-1" && filter ? ` with ${!filterLogic && filter === 'payment_confirmed' ? 'pending payments' : filter.replaceAll("_", " ")}` : ""}.`);
          }

          resolve([students, Number(count[0].count)]);
        }
      }

      // Log error and reject promise
      catch (e) {
        Log.e(e);
        console.error(e);
        reject("An server error occured. Please try again later.");
      }
    });
  }

  /**
   * Register student
   */
  public static registerStudent(student: ICTStudentRegisterModel): Promise<string> {
    return new Promise(async (resolve, reject) => {
      const db = Database.getInstance();

      try {
        // Check for student ID
        let results = await db.query<ICTStudentModel[]>(
          "SELECT * FROM ict2024_students WHERE student_id = ? LIMIT 1", [student.student_id]
        );

        // If student exists
        if (results.length > 0) {
          return reject("Student ID already registered.");
        }

        // Validate email
        if (!isEmail(student.email)) {
          return reject("Invalid email format.");
        }

        // Check for discount code
        await Admin.isDiscountCodeValid(Number(student.campus_id), student.discount_code);

        // Check for email
        results = await db.query<ICTStudentModel[]>(
          "SELECT * FROM ict2024_students WHERE email = ? LIMIT 1", [student.email]
        );

        // If email exists
        if (results.length > 0) {
          return reject("Email already registered.");
        }

        // Register student
        const result = await db.query<MariaUpdateResult>(`
          INSERT INTO ict2024_students (
            campus_id, student_id, course_id, tshirt_size_id, year_level,
            first_name, last_name, email, discount_code, snack_claimed, date_stamp
          ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW()
          )`,
          [
            student.campus_id,
            student.student_id,
            student.course_id,
            student.tshirt_size_id,
            student.year_level,
            student.first_name,
            student.last_name,
            student.email,
            student.discount_code
          ]
        );

        // If has error
        if (result.affectedRows === 0) {
          return reject("An error occured while registering student. Please try again.");
        }

        // Get campus from campus ID
        const campus = await Admin.getCampuses(student.campus_id) as ICTCampus;
        // Log registration
        Log.i(`🤍 [ICT Congress 2024] [${campus.campus_name}] [REGISTERED] – ${student.first_name} ${student.last_name} (${student.student_id})`);
        // Resolve with message
        resolve("You have successfully registered for the ICT Congress 2024 event. Please proceed to the officer in charge to pay for the registration fee. Thank you! 💛");
      }

      // Log error and reject promise
      catch (e) {
        Log.e(e);
        reject("An error occured while registering student. Please try again later.");
      }
    });
  }

  /**
   * Confirm payment
   * @param student_id Student ID
   * @param rfid RFID
   * @param isCSPSMember Is CSPS member
   */
  public static confirmPaymentByStudentID(student_id: string | number, rfid?: string, isCSPSMember?: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const db = Database.getInstance();

      try {
        // Get current value
        const result = await db.query<ICTStudentModel[]>(
          "SELECT * FROM ict2024_students WHERE student_id = ? LIMIT 1", [student_id]
        );

        // If student ID not found
        if (result.length === 0) {
          return reject("Student ID is not registered!");
        }

        // If payment already confirmed
        if (result[0].payment_confirmed) {
          return reject("Payment already confirmed on " + getReadableDate(result[0].payment_confirmed));
        }

        // If will set and RFID
        if (rfid) {
          try {
            // Get student by RFID (for checking)
            const rfidStudent = await Admin.getStudentByRFID(rfid);
            // If student with this RFID already exists
            return reject(`Student ${rfidStudent.first_name} ${rfidStudent.last_name} (${rfidStudent.student_id}) already has this RFID (${rfid}).`);
          } catch (e) {
            // Do nothing
          }
        }

        // Confirm student
        let updateResult;
        
        // If CSPS member
        if (isCSPSMember === '1') {
          // Check if student is from UC Main and is a CSPS student (for discount)
          if (result[0].course_id !== 1 || result[0].campus_id !== 3) {
            return reject("CSPS member discount is only available for UC Main CSPS students.");
          }

          // Get discount codes
          const earlyCode = await Admin.getDiscountCodes(5) as ICTDiscountCode;
          const regularCode = await Admin.getDiscountCodes(10) as ICTDiscountCode;
          // If early bird
          const isEarlyBird = new Date() < new Date(earlyCode.expiration);

          // Confirm student
          updateResult = await db.query<MariaUpdateResult>(
            `UPDATE ict2024_students SET rfid = ?, discount_code = ?, payment_confirmed = NOW() WHERE student_id = ?`,
            [rfid ?? null, isEarlyBird ? earlyCode.code : regularCode.code, student_id]
          );
        }
        
        // If not CSPS member
        else {
          updateResult = await db.query<MariaUpdateResult>(
            `UPDATE ict2024_students SET rfid = ?, payment_confirmed = NOW() WHERE student_id = ?`,
            [rfid ?? null, student_id]
          );
        }

        // If student successfully confirmed
        if (updateResult.affectedRows > 0) {
          const campus = await Admin.getCampuses(result[0].campus_id) as ICTCampus;
          const course = await Admin.getCourses(result[0].course_id) as ICTCourse;
          const discount_code = await Admin.getDiscountCodes(result[0].discount_code) as ICTDiscountCode;

          // Send receipt
          sendEmail({
            to: result[0].email,
            subject: "Your ICT Congress 2024 payment receipt",
            type: EmailType.ICT_RECEIPT,
            title: "Receipt for ICT Congress 2024",
            data: {
              reference: generateICTCongressReference(Number(result[0].id)),
              student_id: result[0].student_id,
              first_name: result[0].first_name,
              last_name: result[0].last_name,
              campus: campus.campus_name,
              course: course.course_name,
              year_level: result[0].year_level,
              price: discount_code.price,
              total: discount_code.price,
              discount_code: result[0].discount_code,
              registered: getReadableDate(result[0].date_stamp),
              payment_confirmed: getReadableDate(new Date()),
            }
          });

          // Log payment confirmed
          Log.i(`🤍 [ICT Congress 2024] [${campus.campus_name}] [PAYMENT_CONFIRMED] – ${result[0].first_name} ${result[0].last_name} (${result[0].student_id})`);
          // Resolve
          return resolve();
        }

        // Last resort error
        return reject("Oops! Can't confirm payment. Please try again.");
      }

      // Log error and reject promise
      catch (e) {
        Log.e(e);
        reject("An error occured while confirming payment. Please try again later.");
      }
    });
  }

  /**
   * Mark student as present for the event
   * @param data QR Code data or RFID
   */
  public static markStudentAsPresent(data: { qr?: string, rfid?: string }): Promise<ICTStudentModel> {
    return new Promise(async (resolve, reject) => {
      if (!data.qr && !data.rfid) {
        return reject("QR or RFID not provided!");
      }

      const db = Database.getInstance();

      try {
        let id;

        // If using QR
        if (data.qr) {
          id = await Admin.getIDFromQRData(data.qr);
        }

        // Get current value
        const result = await db.query<ICTStudentModel[]>(
          `SELECT * FROM ict2024_students WHERE ${data.qr ? "id" : "rfid"} = ? LIMIT 1`, [data.qr ? id : data.rfid]
        );

        // If student ID not found
        if (result.length === 0) {
          return reject("Student not found!");
        }

        // If student still pending payment
        if (!result[0].payment_confirmed) {
          return reject("Student's payment is still pending.");
        }

        // If student hasn't claimed the tshirt yet
        if (!result[0].tshirt_claimed) {
          return reject("Student hasn't claimed the tshirt yet.");
        }

        // If student already marked as present
        if (result[0].attendance) {
          return reject("You're already marked as present on " + getReadableDate(result[0].attendance));
        }

        // Mark student as present
        const updateResult = await db.query<MariaUpdateResult>(
          `UPDATE ict2024_students SET attendance = NOW() WHERE ${data.qr ? "id" : "rfid"} = ?`, [data.qr ? id : data.rfid]
        );

        // If student successfully marked as present
        if (updateResult.affectedRows > 0) {
          // Get campus
          const campus = await Admin.getCampuses(result[0].campus_id) as ICTCampus;
          // Log marked as present
          Log.i(`🤍 [ICT Congress 2024] [${campus.campus_name}] [PRESENT] – ${result[0].first_name} ${result[0].last_name} (${result[0].student_id})`);
          // Resolve
          return resolve(result[0]);
        }

        // Last resort error
        return reject("Oops! Can't mark student as present. Please try again.");
      }

      // Log error and reject promise
      catch (e) {
        Log.e(e);
        reject(e);
      }
    });
  }

  /**
   * Claim snack by student ID
   * @param data QR Code data or RFID
   */
  public static claimSnackByStudentID(data: { qr?: string, rfid?: string }): Promise<ICTStudentModel> {
    return new Promise(async (resolve, reject) => {
      const db = Database.getInstance();

      try {
        let id;

        // If using QR
        if (data.qr) {
          id = await Admin.getIDFromQRData(data.qr);
        }

        // Get current value
        const result = await db.query<ICTStudentModel[]>(
          `SELECT * FROM ict2024_students WHERE id = ${data.qr ? "id" : "rfid"} = ? LIMIT 1`, [data.qr ? id : data.rfid]
        );

        // If student ID not found
        if (result.length === 0) {
          return reject("Student ID is not registered!");
        }

        // If student still pending payment
        if (!result[0].payment_confirmed) {
          return reject("Student's payment is still pending.");
        }

        // If snack already claimed
        if (result[0].snack_claimed) {
          return reject("Snack already claimed!");
        }

        // Claim snack
        const updateResult = await db.query<MariaUpdateResult>(
          `UPDATE ict2024_students SET snack_claimed = 1 WHERE ${data.qr ? "id" : "rfid"} = ? LIMIT 1`, [data.qr ? id : data.rfid]
        );

        // If snack successfully claimed
        if (updateResult.affectedRows > 0) {
          // Get campus
          const campus = await Admin.getCampuses(result[0].campus_id) as ICTCampus;
          // Log claimed
          Log.i(`🤍 [ICT Congress 2024] [${campus.campus_name}] [SNACK] – ${result[0].first_name} ${result[0].last_name} (${result[0].student_id})`);
          // Resolve
          return resolve(result[0]);
        }

        // Last resort error
        return reject("Oops! Can't claim snack. Please try again.");
      }

      // Log error and reject promise
      catch (e) {
        Log.e(e);
        reject(e);
      }
    });
  }

  /**
   * Claim t-shirt by student ID
   * @param student_id Student ID
   */
  public static claimTShirtByStudentID(student_id: string | number): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const db = Database.getInstance();

      try {
        // Get current value
        const result = await db.query<ICTStudentModel[]>(
          "SELECT * FROM ict2024_students WHERE student_id = ? LIMIT 1", [student_id]
        );

        // If student ID not found
        if (result.length === 0) {
          return reject("Student ID is not registered!");
        }

        // If student still pending payment
        if (!result[0].payment_confirmed) {
          return reject("Student's payment is still pending.");
        }

        // If t-shirt already claimed
        if (result[0].tshirt_claimed) {
          return reject("T-shirt already claimed on " + getReadableDate(result[0].tshirt_claimed));
        }

        // Claim t-shirt
        const updateResult = await db.query<MariaUpdateResult>(
          "UPDATE ict2024_students SET tshirt_claimed = NOW() WHERE student_id = ?", [student_id]
        );

        // If t-shirt successfully claimed
        if (updateResult.affectedRows > 0) {
          // Log claimed
          Log.i(`T-shirt claimed by student ID ${student_id}`);

          // Send QR code
          sendEmail({
            to: result[0].email,
            subject: "ICT congress 2024 Attendance QR Code",
            type: EmailType.ICT_QR,
            title: "Your ICT congress 2024 Attendance QR Code",
            data: {
              first_name: result[0].first_name,
              last_name: result[0].last_name,
              qrcode_url: `${Strings.DOMAIN_API}/qrcode?q=${generateICTCongressReference(result[0].id)}`,
            }
          });

          // Get campus
          const campus = await Admin.getCampuses(result[0].campus_id) as ICTCampus;
          // Log claimed
          Log.i(`🤍 [ICT Congress 2024] [${campus.campus_name}] [TSHIRT_QR] – ${result[0].first_name} ${result[0].last_name} (${result[0].student_id})`);
          // Resolve
          return resolve();
        }

        // Last resort error
        return reject("Oops! Can't claim t-shirt. Please try again.");
      }

      // Log error and reject promise
      catch (e) {
        Log.e(e);
        reject(ErrorTypes.DB_ERROR);
      }
    });
  }

  /**
   * Get pending orders count
   */
  public static getPendingOrdersCount(campus_id: number): Promise<number> {
    return new Promise(async (resolve, reject) => {
      const db = Database.getInstance();

      try {
        // Query pending orders
        const result = await db.query<[{ count: bigint }]>(
          "SELECT COUNT(*) as count FROM ict2024_students WHERE campus_id = ? AND payment_confirmed IS NULL", [ campus_id ]
        );

        // Get count
        resolve(Number(result[0].count));
      }

      // Log error and reject promise
      catch (e) {
        Log.e(e);
        reject("Oops! Can't get pending orders. Please try again later.");
      }
    });
  }

  /**
   * Remove students with pending orders
   * @param campus_id Campus ID
   */
  public static removePendingOrders(campus_id: number): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const db = Database.getInstance();

      try {
        // Remove pending orders
        await db.query("DELETE FROM ict2024_students WHERE campus_id = ? AND payment_confirmed IS NULL", [campus_id]);
        // Log removed
        Log.i(`Removed pending orders for campus ID — ${campus_id}`);
        // Resolve
        resolve();
      }

      // Log error and reject promise
      catch (e) {
        Log.e(e);
        reject("Oops! Can't remove pending orders. Please try again later.");
      }
    });
  }

  /**
   * Remove student record
   * @param student_id Student's ID
   */
  public static removeStudent(student_id: string): Promise<ICTStudentModel> {
    return new Promise(async (resolve, reject) => {
      const db = Database.getInstance();

      try {
        // Get student
        const result = await db.query<ICTStudentModel[]>(
          "SELECT * FROM ict2024_students WHERE student_id = ? LIMIT 1", [student_id]
        );

        // If student not found
        if (result.length === 0) {
          return reject("Student not found.");
        }

        // If student already confirmed payment or tshirt
        if ( result[0].payment_confirmed || result[0].tshirt_claimed) {
          return reject("Only students with pending orders can be removed.");
        }

        // Remove pending order
        const updateResult = await db.query<MariaUpdateResult>(
          "DELETE FROM ict2024_students WHERE student_id = ?", [student_id]
        );

        // If student successfully removed
        if (updateResult.affectedRows > 0) {
          // Log removed
          Log.i(`Removed student ID ${student_id}`);
          // Resolve
          return resolve(result[0]);
        }

        // Last resort error
        return reject("Oops! Remove unsuccessful. Please try again.");
      }

      // Log error and reject promise
      catch (e) {
        Log.e(e);
        reject("Oops! Can't remove student. Please try again later.");
      }
    });
  }

  /**
   * Export data to excel spreadsheet
   * @param campus_id Campus ID
   */
  public static exportToSheets(campus_id: number): Promise<File> {
    return new Promise(async (resolve, reject) => {
      const db = Database.getInstance();

      try {
        // From the session data, select students who claimed t-shirts associated with their campus.
        const result = await db.query<ICTStudentModel[]>(
          `SELECT * FROM ict2024_students WHERE campus_id = ? AND tshirt_claimed IS NOT NULL ORDER BY last_name`, [campus_id]
        );

        // If no students found
        if (result.length === 0) {
          return reject("No students found.");
        }
        
        // Get template's absolute path
        const path = join(import.meta.dir, "../../../templates/xlsx/ictcongress2024_campus.xlsx");
        // Create XLSX template
        const xlsx = new XLSXTemplate();
        const courses = await Admin.getCourses() as ICTCourse[];
        const tshirtSizes = await Admin.getTShirtSizes() as ICTShirtSize[];
        const campuses = await Admin.getCampuses() as ICTCampus[];
        let i = 1;

        // Get campus from campus_id
        const campus = campuses.find(c => c.id === campus_id);

        // Load template
        xlsx.loadTemplate(Buffer.from(await Bun.file(path).arrayBuffer()));
        // Substitute data
        xlsx.substitute(1, {
          campus: `ICT Congress 2024 – ${campus?.campus_name}`,
          date: getDatestamp(new Date()),
          student: result.map(student => ({
            id: i++,
            student_id: student.student_id,
            first_name: student.first_name,
            last_name: student.last_name,
            courseyear: courses.find(c => c.id === student.course_id)?.course_name + " " + student.year_level,
            tshirt_size: tshirtSizes.find(s => s.id === student.tshirt_size_id)?.code.toUpperCase(),
          }))
        });

        // Generate output
        const output: Uint8Array = xlsx.generate({ type: "blob" });
        // Create file
        const file = new File([output], `ictcongress2024_report_${campus?.campus}.xlsx`, {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        });

        // Resolve
        resolve(file);
      } catch (e) {
        Log.e(e);
        reject(e);
      }
    });
  }

  /**
   * Export data to CSV
   * @param campus_id Campus ID
   */
  public static exportToCsv(campus_id: number): Promise<File> {
    return new Promise(async (resolve, reject) => {
      const db = Database.getInstance();

      try {
        // From the session data, select students who claimed t-shirts associated with their campus.
        const result = await db.query<ICTStudentModel[]>(
          `SELECT * FROM ict2024_students WHERE campus_id = ? AND tshirt_claimed IS NOT NULL ORDER BY last_name`, [campus_id]
        );

        // If no students found
        if (result.length === 0) {
          return reject("No students found.");
        }

        // Data
        const courses = await Admin.getCourses() as ICTCourse[];
        const tshirtSizes = await Admin.getTShirtSizes() as ICTShirtSize[];
        const campuses = await Admin.getCampuses() as ICTCampus[];
        let i = 1;

        // Get campus from campus_id
        const campus = campuses.find(c => c.id === campus_id);

        // Create CSV
        const csv = [
          "ID,Student ID,First Name,Last Name,Course/Year Level,T-shirt Size",
          ...result.map(student => [
            i++,
            student.student_id,
            student.first_name,
            student.last_name,
            `${courses.find(c => c.id === student.course_id)?.course_name} ${student.year_level}`,
            tshirtSizes.find(s => s.id === student.tshirt_size_id)?.code.toUpperCase()
          ].join(","))
        ].join("\n");

        // Convert array to Uint8Array
        const data = Buffer.from(new TextEncoder().encode(csv));
        // Create file
        const file = new File([data], `ictcongress2024_report_${campus?.campus}.csv`, {
          type: "text/csv"
        });

        // Resolve
        resolve(file);
      } catch (e) {
        Log.e(e);
        reject(e);
      }
    });
  }

  /**
   * Get ICT Congress status statistics
   * @param campus_id Campus ID
   */
  public static getStatistics(campus_id: number): Promise<ICTStatistics> {
    return new Promise(async (resolve, reject) => {
      const db = Database.getInstance();

      try {
        // Main query
        const query = "SELECT COUNT(*) as count FROM ict2024_students WHERE campus_id = ? AND ";
        // Get count all
        const countAll = await db.query<[{ count: bigint }]>(query.split("AND")[0], [campus_id]);
        // Get pending payments count
        const countPendingPayments = await db.query<[{ count: bigint }]>(`${query} payment_confirmed IS NULL`, [campus_id]);
        // Get present count
        const countPresent = await db.query<[{ count: bigint }]>(`${query} attendance IS NOT NULL`, [campus_id]);
        // Get snack claimed count
        const countSnackClaimed = await db.query<[{ count: bigint }]>(`${query} snack_claimed = 1`, [campus_id]);
        // Get paytment confirmed count
        const countPaymentConfirmed = await db.query<[{ count: bigint }]>(`${query} payment_confirmed IS NOT NULL`, [campus_id]);
        // Get T-shirt claimed count
        const countTShirtClaimed = await db.query<[{ count: bigint }]>(`${query} tshirt_claimed IS NOT NULL`, [campus_id]);

        // Resolve
        resolve({
          countAll: Number(countAll[0].count),
          countPendingPayments: Number(countPendingPayments[0].count),
          countPresent: Number(countPresent[0].count),
          countSnackClaimed: Number(countSnackClaimed[0].count),
          countPaymentConfirmed: Number(countPaymentConfirmed[0].count),
          countTShirtClaimed: Number(countTShirtClaimed[0].count),
        });
      }

      // Log error and reject promise
      catch (e) {
        Log.e(e);
        reject("Oops! Can't get statistics. Please try again later.");
      }
    });
  }

  /**
   * Check if discount code is valid
   * @param campus_id Campus ID
   * @param discount_code Discount code
   */
  public static isDiscountCodeValid(campus_id: number, discount_code: string): Promise<boolean> {
    return new Promise(async (resolve, reject) => {
      const db = Database.getInstance();

      try {
        // Get discount code
        const result = await db.query<ICTDiscountCode[]>(
          "SELECT * FROM ict2024_discount_codes WHERE code = ? LIMIT 1", [discount_code]
        );

        // If discount code not found
        if (result.length === 0) {
          return reject("Discount code not found.");
        }

        // If discount code is for another campus
        if (result[0].campus_id !== campus_id) {
          return reject("Discount code is not valid for this campus.");
        }

        // If discount has expired
        if (new Date(result[0].expiration) <= new Date()) {
          return reject("Discount code is expired.");
        }

        // If discount code is valid
        resolve(true);
      }

      // Log error and reject promise
      catch (e) {
        Log.e(e);
        reject("Oops! Can't validate discount code. Please try again later.");
      }
    });
  }

  /**
   * Get courses
   */
  public static getCourses(id?: number): Promise<ICTCourse | ICTCourse[]> {
    return new Promise(async (resolve, reject) => {
      const db = Database.getInstance();

      try {
        // Get courses
        const courses = await db.query<ICTCourse[]>(
          "SELECT * FROM ict2024_courses" + (id ? " WHERE id = ?" : ""), id ? [id] : undefined
        );

        // If id is provided
        if (id) {
          return resolve(courses[0]);
        }

        // Otherwise, return all courses
        resolve(courses);
      }

      // Log error and reject promise
      catch (e) {
        Log.e(e);
        reject(ErrorTypes.DB_ERROR);
      }
    });
  }

  /**
   * Get campuses
   */
  public static getCampuses(id?: number): Promise<ICTCampus | ICTCampus[]> {
    return new Promise(async (resolve, reject) => {
      const db = Database.getInstance();

      try {
        // Get campuses
        const campuses = await db.query<ICTCampus[]>(
          "SELECT * FROM ict2024_campus" + (id ? " WHERE id = ?" : ""), id ? [id] : undefined
        );

        // If id is provided
        if (id) {
          return resolve(campuses[0]);
        }

        // Otherwise, return all courses
        resolve(campuses);
      }

      // Log error and reject promise
      catch (e) {
        Log.e(e);
        reject(ErrorTypes.DB_ERROR);
      }
    });
  }

  /**
   * Get t-shirt sizes
   */
  public static getTShirtSizes(id?: number): Promise<ICTShirtSize | ICTShirtSize[]> {
    return new Promise(async (resolve, reject) => {
      const db = Database.getInstance();

      try {
        // Get t-shirt sizes
        const tshirtSizes = await db.query<ICTShirtSize[]>(
          "SELECT * FROM ict2024_tshirt_sizes" + (id ? " WHERE id = ?" : ""), id ? [id] : undefined
        );

        // If id is provided
        if (id) {
          return resolve(tshirtSizes[0]);
        }

        // Otherwise, return all t-shirt sizes
        resolve(tshirtSizes);
      }

      // Log error and reject promise
      catch (e) {
        Log.e(e);
        reject(ErrorTypes.DB_ERROR);
      }
    });
  }

  /**
   * Get discount codes
   */
  public static getDiscountCodes(discount_code?: string | number): Promise<ICTDiscountCode[] | ICTDiscountCode> {
    return new Promise(async (resolve, reject) => {
      const db = Database.getInstance();

      try {
        // Get discount codes
        const discountCodes = await db.query<ICTDiscountCode[]>(
          "SELECT * FROM ict2024_discount_codes" + (discount_code ? ` WHERE ${typeof discount_code === 'number' ? 'id': 'code'} = ? LIMIT 1` : ""),
          discount_code ? [ discount_code ] : undefined
        );

        // If discount code is provided
        if (discountCodes.length === 1) {
          return resolve(discountCodes[0]);
        }

        // Resolve discount codes
        return resolve(discountCodes);
      }

      // Log error and reject promise
      catch (e) {
        Log.e(e);
        reject("Oops! Can't get discount codes. Please try again later.");
      }
    });
  }

  /**
   * Get ID from QR data
   * @param qr QR Code data
   */
  private static getIDFromQRData(qr: string): Promise<number> {
    return new Promise((resolve, reject) => {
      // Check if QR code is valid
      if (!qr.trim().startsWith("CSPSICT2024")) {
        return reject("Invalid QR code.");
      }

      // Get ID
      const id = Number(qr.substring(qr.length - 4));

      // If ID is not a number
      if (isNaN(id)) {
        return reject("Malformed QR code.");
      }

      // Resolve ID
      resolve(id);
    });
  }
}
export default Admin;
