import { MariaUpdateResult } from "../../../types";
import { AttendanceModel, TatakformModel } from "../../../types/models";

import Database from "../..";
import Log from "../../../utils/log";
import Tatakform from "./tatakform";

enum Days {
  DAY1AM = "day1_am",
  DAY1PM = "day1_pm",
  DAY2AM = "day2_am",
  DAY2PM = "day2_pm",
  DAY3AM = "day3_am",
  DAY3PM = "day3_pm"
}

/**
 * TatakForm Attendance Model
 * @author mavyfaby (Maverick Fabroa)
 * @author TotalElderBerry (lala)
 */
class TatakFormAttendance {
  /**
   * Attend student
   * @param studentId Student ID
   * @param collegeId College ID
   * @param event Tatakform event
   */
  public static attendStudent(studentId: string, collegeId: number, event: TatakformModel) {
    return new Promise(async (resolve, reject) => {
      // Default column name
      let columnName = Days.DAY1AM;
      // Query
      let query = "";

      // Get database instance
      const db = Database.getInstance();
      // Get current date
      const currentDate = new Date();
      // Get from date
      const fromDate = new Date(event.from_date);
      // Get to date
      const toDate = new Date(event.to_date);
      toDate.setDate(toDate.getDate() + 1)

      // Check if event is open
      if (currentDate >= fromDate && currentDate <= toDate) {
        const dayDifference = Math.floor((currentDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
        const currentDay = dayDifference + 1;
        const isAM = currentDate.getHours() < 12;

        if (currentDay === 1 && !isAM) {
          columnName = Days.DAY1PM;
        } else if (currentDay === 2 && isAM) {
          columnName = Days.DAY2AM;
        } else if (currentDay === 2 && !isAM) {
          columnName = Days.DAY2PM;
        } else if (currentDay === 3 && isAM) {
          columnName = Days.DAY3AM;
        } else if (currentDay === 3 && !isAM) {
          columnName = Days.DAY3PM;
        }
      } else if (currentDate < fromDate) {
        return reject("Event is still closed.");
      } else {
        return reject("Event already ended.");
      }

      try {
        // Check if student has already attended
        if (await TatakFormAttendance.hasAttended(studentId, event.id)) {
          // Check if student has not yet registered time
          await TatakFormAttendance.isStudentAttended(studentId, event.id, columnName);

          // Query to update attendance
          query = `UPDATE tatakforms_attendance SET ${columnName} = NOW() WHERE student_id = ? and event_id = ?`

          // Update attendance
          const updateResult = await db.query<MariaUpdateResult>(
            query, [studentId, event.id]
          );

          // Resolve promise
          if (updateResult.affectedRows > 0) {
            Log.i(`✅ [TATAKFORM] [ATTENDANCE] [${studentId}] ${TatakFormAttendance.mapDayName(columnName)}`);
            resolve(`Student (${studentId}) has attended for ${TatakFormAttendance.mapDayName(columnName)}.`);

            // Send to socket client
            TatakFormAttendance.sendToSocketClients(collegeId, event.slug);
          }
        }
        
        // If student has not yet attended
        else {
          query = `INSERT INTO tatakforms_attendance (student_id, event_id, ${columnName}) VALUES (?,?,NOW())`
          
          // Insert attendance
          const updateResult = await db.query<MariaUpdateResult>(
            query, [studentId, event.id]
          );

          // Resolve promise
          if (updateResult.affectedRows > 0) {
            Log.i(`✅ [TATAKFORM] [ATTENDANCE] [${studentId}] ${TatakFormAttendance.mapDayName(columnName)}`);
            resolve(`Student (${studentId}) has attended for ${TatakFormAttendance.mapDayName(columnName)}.`);

            // Send to socket client
            TatakFormAttendance.sendToSocketClients(collegeId, event.slug);
          }
        }
      } catch (error) {
        Log.e(error)
        reject(error)
      }
    });
  }

  /**
   * Send message to socket client
   */
  private static async sendToSocketClients(collegeId: number, eventSlug: string) {
    // Get socket client
    const sockets = Tatakform.getSocketClientsWith(collegeId);

    // If empty
    if (sockets.length === 0) {
      Log.e(`❌ [TATAKFORM] [ATTENDANCE] [WEBSOCKET] [COLLEGE #${collegeId}] There were no socket clients connected.`);
      return;
    }

    // Get count
    const count = await TatakFormAttendance.getStudentCountAttendedBySlugAndCollege(eventSlug, collegeId);

    // For every sockets
    for (const socket of sockets) {
      // Emit event
      socket.send(count);
    }

    // Log
    Log.i(`📡 [TATAKFORM] [ATTENDANCE] [WEBSOCKET] [COLLEGE #${collegeId}] Updated attendance count.`);
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
  public static getStudentsAttendedByEventAndCollege(eventId: number, collegeId: number, day?: Days) {
    return new Promise(async (resolve, reject) => {
      // Get database instance
      const db = Database.getInstance();

      try {
        const result = await db.query<AttendanceModel[]>(
          `SELECT
            a.*, s.first_name, s.last_name, s.course_id, c.acronym
          FROM
            tatakforms_attendance a
          INNER JOIN
            tatakforms_students s
          INNER JOIN
            colleges_courses c ON c.id = s.course_id
          WHERE
            a.student_id = s.student_id AND event_id = ? and c.college_id = ? ${day ? `AND ${day} IS NOT NULL` : ""}
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
   * Get all attendance count by event and college
   */
  public static getStudentCountAttendedBySlugAndCollege(eventSlug: string, collegeId: number) {
    return new Promise(async (resolve, reject) => {
      // Get database instance
      const db = Database.getInstance();

      try {
        const result = await db.query<{ count: bigint }[]>(
          `SELECT
            COUNT(*) AS count
          FROM
            tatakforms_attendance a
          INNER JOIN
            tatakforms_students s ON a.student_id = s.student_id
          INNER JOIN
            tatakforms t ON a.event_id = t.id
          INNER JOIN
            colleges_courses c ON c.id = s.course_id
          WHERE
            a.student_id = s.student_id AND t.slug = ? and c.college_id = ?
          `, [eventSlug, collegeId]
        );

        resolve(Number(result[0].count));
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

  /**
   * Map day name
   */
  private static mapDayName(day: Days) {
    switch (day) {
      case Days.DAY1AM:
        return "Day 1 AM";
      case Days.DAY1PM:
        return "Day 1 PM";
      case Days.DAY2AM:
        return "Day 2 AM";
      case Days.DAY2PM:
        return "Day 2 PM";
      case Days.DAY3AM:
        return "Day 3 AM";
      case Days.DAY3PM:
        return "Day 3 PM";
    }
  }
}

export default TatakFormAttendance;
