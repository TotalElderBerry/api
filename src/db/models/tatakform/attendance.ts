import Database from "../..";
import { MariaUpdateResult } from "../../../types";
import { AttendanceModel, TatakformModel } from "../../../types/models";
import Log from "../../../utils/log";

/**
 * TatakForm Attendance Model
 * @author TotalElderBerry (lala)
 */
class TatakFormAttendance {
  /**
   * Attend student
   */
  public static attendStudent(studentId: any, event: TatakformModel) {
    return new Promise(async (resolve, reject) => {
      // Get database instance
      const db = Database.getInstance();

      const currentDate = new Date();
      const fromDate = new Date(event.from_date);
      const toDate = new Date(event.to_date);

      let query;
      let columnName = "day1_am";

      // Check if event is open
      if (currentDate >= fromDate && currentDate <= toDate) {
        const dayDifference = Math.floor((currentDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
        const currentDay = dayDifference + 1;
        const isAM = currentDate.getHours() < 12;
        
        if (currentDay === 1 && !isAM) {
          columnName = "day1_pm";
        } else if (currentDay === 2 && isAM) {
          columnName = "day2_am";
        } else if (currentDay === 2 && !isAM) {
          columnName = "day2_pm";
        } else if (currentDay === 3 && isAM) {
          columnName = "day3_am";
        } else if (currentDay === 3 && !isAM) {
          columnName = "day3_pm";
        }
      } else if (currentDate < fromDate){
        return reject("Event is still closed.");
      } else {
        return reject("Event already ended.");
      }

      try {
        // Check if student has already attended
        if (await TatakFormAttendance.hasAttended(studentId, event.id)) {
          // Check if student has not yet registered time
          await TatakFormAttendance.isStudentAttended(studentId, event.id, columnName);

          query = `UPDATE attendance SET ${columnName} = NOW() WHERE student_id = ? and event_id = ?`
          const updateResult = await db.query<MariaUpdateResult>(
            query, [studentId, event.id]
          );
          if (updateResult.affectedRows > 0) {
            resolve("Updated Attendance")
          }
        } else {
          query = `INSERT INTO attendance (student_id, event_id, ${columnName}) VALUES (?,?,NOW())`
          const updateResult = await db.query<MariaUpdateResult>(
            query, [studentId, event.id]
          );
          if (updateResult.affectedRows > 0) {
            resolve("Added your attendance")
          }
        }
      } catch (error) {
        Log.e(error)
        reject(error)
      }

    });
  }

  /**
   * Check if student has already attended
   */
  public static hasAttended(studentId: string, eventId: number): Promise<boolean> {
    return new Promise(async (resolve, reject) => {
      // Get database instance
      const db = Database.getInstance();

      try {
        // Get admin by username
        const result = await db.query<[{ count: bigint }]>(
          "SELECT COUNT(*) as count FROM tatakforms_attendance WHERE student_id = ? and event_id = ?", [studentId, eventId]
        );

        // Resolve promise
        resolve(result[0].count > 0);
      }

      // Log error and reject promise
      catch (e) {
        Log.e(e);
        reject(e);
      }
    });
  }

  /**
   * Get attendance history of student
   */
  public static getAttendanceByEvent(studentId: string, eventId: number): Promise<AttendanceModel | null> {
    return new Promise(async (resolve, reject) => {
      // Get database instance
      const db = Database.getInstance();

      try {
        // Get attendance by event
        const result = await db.query<AttendanceModel[]>(
          "SELECT * FROM tatakforms_attendance WHERE student_id = ? and event_id = ?", [studentId, eventId]
        );

        resolve(result.length > 0 ? result[0] : null);
      }

      // Log error and reject promise
      catch (e) {
        Log.e(e);
        reject(e);
      }
    });
  }

  /**
   * Get all attendance
   */
  public static getAttendance(studentId: any) {
    return new Promise(async (resolve, reject) => {
      // Get database instance
      const db = Database.getInstance();

      try {
        // Get admin by username
        const result = await db.query<AttendanceModel[]>(
          "SELECT * FROM tatakforms_attendance WHERE student_id = ?", [studentId]
        );
        resolve([result, result.length]);
      }

      // Log error and reject promise
      catch (e) {
        Log.e(e);
        reject(e);
      }
    });
  }

  /**
   * Get all attendance of students by event and college
   */
  public static getStudentsAttendedByEventAndCollege(eventId: any, collegeId: any) {
    return new Promise(async (resolve, reject) => {
      // Get database instance
      const db = Database.getInstance();

      try {
        const result = await db.query<AttendanceModel[]>(
          `SELECT
            attendance.*, s.first_name, s.last_name, s.course_id, c.acronym
          FROM
            attendance
          INNER JOIN
            tatakforms_students s
          INNER JOIN
            colleges_courses c ON c.id = s.course_id
          WHERE
            attendance.student_id = s.student_id AND event_id = ? and c.college_id = ?
          `, [eventId, collegeId]
        );

        if (result) {
          resolve(result);
        } else {
          reject("Error")
        }
      }

      // Log error and reject promise
      catch (e) {
        Log.e(e);
        reject(e);
      }
    });
  }

  /**
   * Check if student has not yet attendance 
   */
  private static isStudentAttended(studentId: string, eventId: number, columnName: string) {
    return new Promise(async (resolve, reject) => {
      // Get database instance
      const db = Database.getInstance();

      try {
        // Get admin by username
        const result = await db.query<any>(
          `SELECT ${columnName} FROM tatakforms_attendance WHERE student_id = ? AND event_id = ?`, [studentId, eventId]
        );

        // Resolve promise
        if (result.length === 0 || result[0][columnName] === null) {
          return resolve(result[0]);
        }

        return reject("You already have attended.");
      }

      // Log error and reject promise
      catch (e) {
        Log.e(e);
        reject(e);
      }
    });
  }
}

export default TatakFormAttendance;
