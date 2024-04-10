import type { CollegeModel, TatakformStudent, UnivStudentModel } from "../../../types/models";
import type { MariaUpdateResult } from "../../../types";

import { PaginationOutput } from "../../../types/request";
import { EmailType, ErrorTypes } from "../../../types/enums";
import { sendEmail } from "../../../utils/email";

import { isNumber, isEmail, trim, isObjectEmpty } from "../../../utils/string";
import { generateToken, hashPassword } from "../../../utils/security";
import { paginationWrapper } from "../../../utils/pagination";
import { UnivStudentsColumn } from "../../structure.d";

import Database from "../..";
import Log from "../../../utils/log";
import Strings from "../../../config/strings";
import Config from "../../../config";
import College from "../college";

/**
 * TatakForm Student model
 * This model represents a student in the database
 * @author TotalElderBerry (Hey)
 */
class TatakFormStudent {

  /**
   * Get all students
   */
  public static getAll(pagination?: PaginationOutput): Promise<[ UnivStudentModel[], count: number ]> {
    return new Promise(async (resolve, reject) => {
      // Get database instance
      const db = Database.getInstance();

      try {
        // Get pagination
        if (pagination && !isObjectEmpty(pagination)) {
          const { query, countQuery, values, countValues } = paginationWrapper(db, {
            query: "SELECT * FROM tatakforms_students ORDER BY id DESC",
            request: pagination
          });

          const mainResult = await db.query<UnivStudentModel[]>(query, values);
          const countResult = await db.query<[{ count: bigint }]>(countQuery, countValues);

          // If no results
          if (mainResult.length === 0) {
            Log.i("No students found");
            return reject(ErrorTypes.DB_EMPTY_RESULT);
          }

          return resolve([mainResult, Number(countResult[0].count) ]);
        }
        
        // Get all students
        const result = await db.query<UnivStudentModel[]>(`SELECT * FROM tatakforms_students ORDER BY id DESC`);

        // If no results
        if (result.length === 0) {
          Log.e("No students found");
          return reject(ErrorTypes.DB_EMPTY_RESULT);
        }

        // Resolve promise
        resolve([ result, result.length ]);
      }
      
      // Log error and reject promise
      catch (e) {
        Log.e(e);
        reject(ErrorTypes.DB_ERROR);
      }
    });
  }

  /**
   * Get student by its student id
   * @param student_id Student ID
   * @param fromAdmin If true, will check in admin table
   */
  public static getByStudentId(student_id: string, fromAdmin = false): Promise<UnivStudentModel> {
    return new Promise(async (resolve, reject) => {
      // Get database instance
      const db = Database.getInstance();

      try {
        // Query string
        let query = 'SELECT * FROM tatakforms_students WHERE student_id = ?';

        // If getting data from admin
        if (fromAdmin) {
          query = `
            SELECT
              s.id, s.student_id, s.last_name, s.first_name,
              s.year_level, s.email_address, s.password, s.date_stamp, s.course_id
            FROM
              tatakforms_admin a
            INNER JOIN
              tatakforms_students s ON s.id = a.students_id WHERE s.student_id = ?
          `;
        }

        // Get student
        const result = await db.query<UnivStudentModel[]>(query, [student_id]);
        // If no results
        if (result.length === 0) {
          Log.e(`[TATAKFORM] [getByStudentId] ${fromAdmin ? 'Admin' : 'Student'} not found (id = ${student_id})`);
          return reject(`Student ID (${student_id}) not found`);
        }

        // Resolve promise
        resolve(result[0]);
      }
      
      // Log error and reject promise
      catch (e) {
        Log.e(e);
        reject(e);
      }
    });
  }

  /**
   * Insert student data to the database
   * @param student Student data
   */
  public static insert(student: UnivStudentModel): Promise<void> {
    return new Promise(async (resolve, reject) => {
      // Validate
      const error = TatakFormStudent.validate(student);

      if (error) {
        return reject(error);
      }

      // Check if student id already exists
      if (await TatakFormStudent.isExist(UnivStudentsColumn.STUDENT_ID, student.student_id)) {
        Log.i(`Student ID already exists (${student.student_id})`);
        return reject([Strings.STUDENT_ALREADY_EXIST, UnivStudentsColumn.STUDENT_ID]);
      }

      // Check if email already exists
      if (await TatakFormStudent.isExist(UnivStudentsColumn.EMAIL_ADDRESS, student.email_address)) {
        Log.i(`Student email already exists (${student.email_address})`);
        return reject([Strings.STUDENT_EMAIL_ALREADY_EXIST, UnivStudentsColumn.EMAIL_ADDRESS]);
      }

      // Log inserting student
      Log.i(`Inserting student (${student.first_name} ${student.last_name} - ${student.student_id})`);

      try {
        // Get database pool connection
        const db = Database.getInstance();
        // Hash password with bcrypt algorithm
        const hash = await hashPassword(student.password || "");
  
        // Insert student
        const result = await db.query<MariaUpdateResult>(
          `INSERT INTO tatakforms_students (student_id, year_level, first_name, last_name, course_id, email_address, password, date_stamp) VALUES (?, ?, ?,?, ?, ?, ?, NOW())`, [
            student.student_id,
            student.year_level,
            student.first_name,
            student.last_name,
            student.course_id,
            student.email_address,
            hash
          ]
        );
  
        // If no affected rows
        if (result.affectedRows === 0) {
          Log.e("Student Insert Failed: No rows affected");
          return reject(ErrorTypes.DB_EMPTY_RESULT);
        }
  
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
   * Send forgot password email
   * @param student_id Student ID
   */
  public static forgotPassword(student_id: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        // Get student by student id
        const student = await TatakFormStudent.getByStudentId(student_id);
        // Add reset token
        const token = await TatakFormStudent.addResetToken(student.id);

        // Log
        Log.i(`📧 [TATAKFORM] Sending forgot password email to ${student.first_name} ${student.last_name} (${student_id})`);

        // Send email
        sendEmail({
          type: EmailType.FORGOT_PASSWORD,
          to: student.email_address,
          subject: Strings.FORGOT_PASSWORD_EMAIL_SUBJECT,
          title: Strings.FORGOT_PASSWORD_EMAIL_SUBJECT,
          data: {
            name: student.first_name + " " + student.last_name,
            link: Strings.DOMAIN + "/tatakforms/reset/" + token,
            validity: Config.TOKEN_VALIDITY
          }
        });

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
   * Add reset token for password reset request
   * @param row_id Student primary database ID
   */
  public static addResetToken(row_id: number): Promise<string> {
    return new Promise(async (resolve, reject) => {
      // Generate token
      const token = await generateToken(Config.TOKEN_LENGTH);

      try {
        // Get database instance
        const db = Database.getInstance();

        // Insert token
        const result = await db.query<MariaUpdateResult>(
          `INSERT INTO tatakforms_reset_tokens (tatakforms_students_id, token, is_used, date_stamp) VALUES (?, ?, 0, NOW())`, [
            row_id, token,
          ]
        );

        // If no affected rows
        if (result.affectedRows === 0) {
          Log.e("[TATAKFORMS] Reset Token Insert Failed: No rows affected");
          return reject("[TATAKFORMS] Student Reset Token Insert Failed: No rows affected");
        }

        // Resolve promise
        resolve(token);
      }

      // Log error and reject promise
      catch (e) {
        Log.e(e);
        reject(e);
      }
    });
  }

  /**
   * Get student by reset token
   * @param token Reset token
   */
  public static fromResetToken(token: string): Promise<TatakformStudent> {
    return new Promise(async (resolve, reject) => {
      // Get database instance
      const db = Database.getInstance();

      try {
        // Get student
        const result = await db.query<(TatakformStudent & { is_used: number, token_created: string })[]>(`
          SELECT
            s.id, s.student_id, s.last_name, s.first_name,
            s.year_level, s.email_address, s.password, s.date_stamp,
            rt.is_used, rt.date_stamp AS token_created
          FROM
            tatakforms_reset_tokens rt
          INNER JOIN
            tatakforms_students s ON s.id = rt.tatakforms_students_id
          WHERE
            rt.token = ?
        `, [token]);

        // If no results
        if (result.length === 0) {
          Log.e(`[TATAKFORMS] [FROM_RESET_TOKEN] Student not found (token = ${token})`);
          return reject(ErrorTypes.DB_EMPTY_RESULT);
        }

        // If token is already used
        if (result[0].is_used > 0) {
          Log.e(`[TATAKFORMS] [FROM_RESET_TOKEN] Token already used (token = ${token})`);
          return reject(ErrorTypes.DB_USED);
        }

        // If token is expired
        const currentDate = new Date();
        const tokenDate = new Date(result[0].token_created);

        if (currentDate.getTime() - tokenDate.getTime() > Config.TOKEN_VALIDITY * 60 * 1000) {
          Log.e(`[TATAKFORMS] [FROM_RESET_TOKEN] Token expired (token = ${token})`);
          return reject(ErrorTypes.DB_EXPIRED);
        }

        // Resolve promise
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
   * Reset password from token
   * @param token Reset token
   * @param password New password
   */
  public static updatePasswordFromToken(token: string, password: string): Promise<TatakformStudent> {
    return new Promise(async (resolve, reject) => {
      // Validate password
      if (!password) {
        return reject([Strings.RESET_PASSWORD_EMPTY_PASSWORD, "password"]);
      }

      // Get connection instance
      const db = await Database.getConnection();

      try {
        // Hash password
        const hash = await hashPassword(password);
        // Get student from token
        const student = await TatakFormStudent.fromResetToken(token);
        // Start transaction
        await db.beginTransaction();

        // Update password
        let result = await db.query<MariaUpdateResult>(
          `UPDATE tatakforms_students SET password = ? WHERE id = ?`, [ hash, student.id ]
        );

        // If no affected rows
        if (result.affectedRows === 0) {
          await db.rollback();
          Log.e("[TATAKFORMS] [RESET_PASSWORD] Student update failed: No rows affected");
          return reject(ErrorTypes.DB_EMPTY_RESULT);
        }

        // Update token
        result = await db.query<MariaUpdateResult>(
          `UPDATE tatakforms_reset_tokens SET is_used = 1, reset_date_stamp = NOW() WHERE token = ?`, [ token ]
        );

        // If no affected rows
        if (result.affectedRows === 0) {
          await db.rollback();
          Log.e("[TATAKFORMS] [RESET_PASSWORD] Reset token update failed: No rows affected");
          return reject(ErrorTypes.DB_EMPTY_RESULT);
        }

        // Commit transaction
        await db.commit();
        // Resolve promise
        resolve(student);
      }

      // Rollback and reject promise
      catch (error) {
        await db.rollback();
        return reject(error);
      }
    });
  }

  /**
   * Get college from student id
   */
  public static getCollegeFromStudentId(student_id: string): Promise<CollegeModel> {
    return new Promise(async (resolve, reject) => {
      // Get database instance
      const db = Database.getInstance();

      try {
        // Get colleges
        const colleges = await College.getAll();
        // Get student
        const student = await TatakFormStudent.getByStudentId(student_id);

        // Find college
        for (const college of colleges) {
          if (!college.courses) continue;

          for (const course of college.courses) {
            if (course.id === student.course_id) {
              return resolve(college);
            }
          }
        }
        
        // If not found
        reject("College not found");
      }
      
      // Log error and reject promise
      catch (e) {
        Log.e(e);
        reject(e);
      }
    });
  }

  /**
   * Check whether a student exists
   * @param key Student column
   * @param value Value to check
   */
  public static isExist(key: UnivStudentsColumn, value: any): Promise<bigint> {
    return new Promise(async (resolve, reject) => {
      // Get database instance
      const db = Database.getInstance();

      try {
        // Log
        Log.i(`Checking if student exists (${key} = ${value})`);
        // Get result
        const result = await db.query<[{ count: bigint }]>(
          `SELECT COUNT(*) AS count FROM tatakforms_students WHERE ${key} = ?`, [value]
        );

        // If no results
        // Note: count is a type of bigint
        return resolve(result[0].count);
      }
      
      // Log error and reject promise
      catch (e) {
        Log.e(e);
        reject(ErrorTypes.DB_ERROR);
      }
    });
  }

  /**
   * Validate student data 
   * @param data Student data
   * @param isUpdate If true, will not check if student id and password
   */
  private static validate(data?: Record<string, any>, isUpdate = false) {
    // Check if data is empty
    if (!data) return [Strings.GENERAL_INVALID_REQUEST];
    // Trim all values
    trim(data);

    if (!isUpdate) {
      // Check if student id is empty
      if (!data.student_id) return [Strings.STUDENT_EMPTY_ID, UnivStudentsColumn.STUDENT_ID];
      // Check if password is empty
      if (!data.password) return [Strings.STUDENT_EMPTY_PASSWORD, UnivStudentsColumn.PASSWORD];
      // Check if student id is a number
      if (!isNumber(data.student_id) || data.student_id.length >= 16) return [Strings.STUDENT_LIMIT_ID, UnivStudentsColumn.STUDENT_ID];
      // Check if email is empty
      if (!data.email_address) return [Strings.STUDENT_EMPTY_EMAIL, UnivStudentsColumn.EMAIL_ADDRESS];
      // Check if email is valid
      if (!isEmail(data.email_address.trim())) return [Strings.STUDENT_INVALID_EMAIL, UnivStudentsColumn.EMAIL_ADDRESS];
    }

    // Check if year level is empty
    if (!data.year_level) return [Strings.STUDENT_EMPTY_YEAR_LEVEL, UnivStudentsColumn.YEAR_LEVEL];
    // Check if first name is empty
    if (!data.first_name) return [Strings.STUDENT_EMPTY_FIRST_NAME, UnivStudentsColumn.FIRST_NAME];
    // Check if last name is empty
    if (!data.last_name) return [Strings.STUDENT_EMPTY_LAST_NAME, UnivStudentsColumn.LAST_NAME];
    // Check if year level is a number and valid
    if (!isNumber(data.year_level) || data.year_level < 1 || data.year_level > 4) return [Strings.STUDENT_LIMIT_YEAR_LEVEL, UnivStudentsColumn.YEAR_LEVEL];
  }
}

export default TatakFormStudent;