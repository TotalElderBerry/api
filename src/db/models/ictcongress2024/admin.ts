import { EmailType, ErrorTypes } from "../../../types/enums";
import Log from "../../../utils/log";
import Database from "../..";
import { ICTCampus, ICTCourse, ICTDiscountCode, ICTStudentModel, ICTStudentRegisterModel } from "../../../types/models";
import { PaginationOutput } from "../../../types/request";
import { isEmail, isObjectEmpty } from "../../../utils/string";
import { paginationWrapper } from "../../../utils/pagination";
import { MariaUpdateResult } from "../../../types";
import { getReadableDate } from "../../../utils/date";
import { sendEmail } from "../../../utils/email";
import { generateICTCongressReference } from "../../../utils/security";

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
          const { query, countQuery, values, countValues } = paginationWrapper(db, {
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
            // Log.i(`[ICT Congress 2024] No students found in the "${pagination}".`);
            return reject(ErrorTypes.DB_EMPTY_RESULT);
          }

          resolve([students, Number(count[0].count) ]);
        }
      }

      // Log error and reject promise
      catch (e) {
        console.error(e);
        Log.e(e);
        reject(ErrorTypes.DB_ERROR);
      }
    });
  }

  /**
   * Register student
   */
  public static registerStudent(student: ICTStudentRegisterModel): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const db = Database.getInstance();

      try {
        // Check for student ID
        let results = await db.query<ICTStudentModel[]>("SELECT * FROM ict2024_students WHERE student_id = ? LIMIT 1", [ student.student_id ]);

        // If student exists
        if (results.length > 0) {
          return reject("Student ID already registered.");
        }

        // Validate email
        if (!isEmail(student.email)) {
          return reject("Invalid email format.");
        }

        // Check for discount code
        if (student.discount_code.length > 0) {
          try {
            await Admin.isDiscountCodeValid(student.discount_code);
          } catch (error) {
            return reject(error);
          }
        }

        // Check for email
        results = await db.query<ICTStudentModel[]>("SELECT * FROM ict2024_students WHERE email = ? LIMIT 1", [ student.email ]);

        // If email exists
        if (results.length > 0) {
          return reject("Email already registered.");
        }

        // Register student
        await db.query(`
          INSERT INTO ict2024_students (
            campus_id, student_id, course_id, tshirt_size_id, year_level,
            first_name, last_name, email, discount_code, snack_claimed, date_stamp
          ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW()
          )`, [
          student.campus_id,
          student.student_id,
          student.course_id,
          student.tshirt_size_id,
          student.year_level,
          student.first_name,
          student.last_name,
          student.email,
          student.discount_code
        ]);

        resolve();
      }

      // Log error and reject promise
      catch (e) {
        Log.e(e);
        reject(ErrorTypes.DB_ERROR);
      }
    });
  }

  /**
   * Confirm payment
   * @param student_id Student ID
   */
  public static confirmPaymentByStudentID(student_id: string | number): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const db = Database.getInstance();

      try {
        // Get current value
        const result = await db.query<ICTStudentModel[]>(
          "SELECT * FROM ict2024_students WHERE student_id = ? LIMIT 1", [ student_id ]
        );

        // If student ID not found
        if (result.length === 0) {
          return reject("Student ID is not registered!");
        }
        
        // If payment already confirmed
        if (result[0].payment_confirmed) {
          return reject("Payment already confirmed in " + getReadableDate(result[0].payment_confirmed));
        }

        // Confirm student
        const updateResult = await db.query<MariaUpdateResult>(
          "UPDATE ict2024_students SET payment_confirmed = NOW() WHERE student_id = ?", [ student_id ]
        );

        // If student successfully confirmed
        if (updateResult.affectedRows > 0) {
          const campus = await Admin.getCampuses(result[0].campus_id) as ICTCampus;
          const course = await Admin.getCourses(result[0].course_id) as ICTCourse;

          // Send receipt
          sendEmail({
            to: result[0].email,
            subject: "Your ICT Congress 2024 payment receipt",
            type: EmailType.ICT_RECEIPT,
            title: "Receipt for ICT Congress 2024",
            data: {
              reference: generateICTCongressReference(Number(updateResult.insertId)),
              student_id: result[0].student_id,
              first_name: result[0].first_name,
              last_name: result[0].last_name,
              campus: campus.campus_name,
              course: course.course_name,
              year_level: result[0].year_level,
              price: process.env.ICT_CONGRESS_PRICE,
              total: process.env.ICT_CONGRESS_PRICE,
              registered: getReadableDate(result[0].date_stamp),
              payment_confirmed: getReadableDate(new Date()),
            }
          });

          return resolve();
        }

        // Last resort error
        return reject("Oops! Can't confirm payment. Please try again.");
      }

      // Log error and reject promise
      catch (e) {
        Log.e(e);
        reject(ErrorTypes.DB_ERROR);
      }
    });
  }

  /**
   * Mark student as present for the event
   * @param student_id Student ID
   */
  public static markStudentAsPresent(student_id: string | number): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const db = Database.getInstance();

      try {
        // Get current value
        const result = await db.query<ICTStudentModel[]>(
          "SELECT * FROM ict2024_students WHERE student_id = ? LIMIT 1", [ student_id ]
        );

        // If student ID not found
        if (result.length === 0) {
          return reject("Student ID is not registered!");
        }

        // If student already marked as present
        if (result[0].attendance) {
          return reject("Student already marked as present in " + getReadableDate(result[0].attendance));
        }

        // Mark student as present
        const updateResult = await db.query<MariaUpdateResult>(
          "UPDATE ict2024_students SET attendance = NOW() WHERE student_id = ?", [ student_id ]
        );
        
        // If student successfully marked as present
        if (updateResult.affectedRows > 0) {
          return resolve();
        }

        // Last resort error
        return reject("Oops! Can't mark student as present. Please try again.");
      }

      // Log error and reject promise
      catch (e) {
        Log.e(e);
        reject(ErrorTypes.DB_ERROR);
      }
    });
  }

  /**
   * Claim snack by student ID
   * @param student_id Student ID
   */
  public static claimSnackByStudentID(student_id: string | number): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const db = Database.getInstance();

      try {
        // Get current value
        const result = await db.query<ICTStudentModel[]>(
          "SELECT * FROM ict2024_students WHERE student_id = ? LIMIT 1", [ student_id ]
        );

        // If student ID not found
        if (result.length === 0) {
          return reject("Student ID is not registered!");
        }

        // If snack already claimed
        if (result[0].snack_claimed) {
          return reject("Snack already claimed!");
        }

        // Claim snack
        const updateResult = await db.query<MariaUpdateResult>(
          "UPDATE ict2024_students SET snack_claimed = 1 WHERE student_id = ?", [ student_id ]
        );
        
         // If snack successfully claimed
        if (updateResult.affectedRows > 0) {
          return resolve();
        }

        // Last resort error
        return reject("Oops! Can't claim snack. Please try again.");
      }

      // Log error and reject promise
      catch (e) {
        Log.e(e);
        reject(ErrorTypes.DB_ERROR);
      }
    });
  }

  /**
   * Check if discount code is valid
   * @param discount_code Discount code
   */
  public static isDiscountCodeValid(discount_code: string): Promise<boolean> {
    return new Promise(async (resolve, reject) => {
      const db = Database.getInstance();

      try {
        // Get discount code
        const result = await db.query<ICTDiscountCode[]>(
          "SELECT * FROM ict2024_discount_codes WHERE code = ? LIMIT 1", [ discount_code ]
        );

        // If discount code not found
        if (result.length === 0) {
          return reject("Discount code not found :(");
        }

        // If discount has expired
        if (new Date(result[0].expiration) < new Date()) {
          return reject("Discount code is expired :(");
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
  public static getTShirtSizes(): Promise<any> {
    return new Promise(async (resolve, reject) => {
      const db = Database.getInstance();

      try {
        // Get t-shirt sizes
        const tshirtSizes = await db.query("SELECT * FROM ict2024_tshirt_sizes");
        resolve(tshirtSizes);
      }

      // Log error and reject promise
      catch (e) {
        Log.e(e);
        reject(ErrorTypes.DB_ERROR);
      }
    });
  }
}
export default Admin;