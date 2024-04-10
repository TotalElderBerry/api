import { MariaUpdateResult } from "../../../types";
import { AttendanceModel, TatakformModel } from "../../../types/models";

import Database from "../..";
import Log from "../../../utils/log";
import Tatakform from "./tatakform";
import TatakFormStudent from "./student";
import College from "../college";

enum Days {
  DAY1AM = "day1_am",
  DAY1PM = "day1_pm",
  DAY2AM = "day2_am",
  DAY2PM = "day2_pm",
  DAY3AM = "day3_am",
  DAY3PM = "day3_pm"
}

enum EventStatus {
  NOT_ACCEPTING,
  NOT_YET_OPEN,
  ALREADY_CLOSED
}

/**
 * TatakForm Attendance Model
 * @author mavyfaby (Maverick Fabroa)
 * @author TotalElderBerry (lala)
 */
class TatakFormAttendance {
  /**
   * Attend student
   */
  public static attendStudent(data: { studentId: string, dateStamp: string, collegeId: number, event: TatakformModel }) {
    return new Promise(async (resolve, reject) => {
      try {
        // Get column name
        const columnName = TatakFormAttendance.getCurrentDay(data.event, data.dateStamp);
        
        // Switch column name
        switch(columnName) {
          case EventStatus.NOT_ACCEPTING:
            return reject("Event is not accepting attendance.");
          case EventStatus.NOT_YET_OPEN:
            return reject("Event is not yet open.");
          case EventStatus.ALREADY_CLOSED:
            return reject("Event is already closed.");
        }

        // Get student's college data
        const college = await TatakFormStudent.getCollegeFromStudentId(data.studentId);

        // If not synced
        if (college.id !== data.collegeId) {
          // Get college from college id
          const c = await College.getById(data.collegeId);
          // Reject promise
          return reject(`Student is not part of ${c.name} college/department.`);
        }

        // Get database instance
        const db = Database.getInstance();
        // Query
        let query = "";

        // Check if student has already attended
        if (await TatakFormAttendance.hasAttended(data.studentId, data.event.id)) {
          // Check if student has not yet registered time
          await TatakFormAttendance.isStudentAttended(data.studentId, data.event.id, columnName);

          // Query to update attendance
          query = `UPDATE tatakforms_attendance SET ${columnName} = ? WHERE student_id = ? and event_id = ?`

          // Update attendance
          const updateResult = await db.query<MariaUpdateResult>(query,
            [data.dateStamp, data.studentId, data.event.id]
          );

          // Resolve promise
          if (updateResult.affectedRows > 0) {
            Log.i(`✅ [TATAKFORM] [ATTENDANCE] [${data.studentId}] ${TatakFormAttendance.mapDayName(columnName)}`);
            resolve(`Student (${data.studentId}) has attended for ${TatakFormAttendance.mapDayName(columnName)}.`);

            // Send to socket client
            TatakFormAttendance.sendToSocketClients(data.collegeId, data.event.slug);
          }
        }
        
        // If student has not yet attended
        else {
          query = `INSERT INTO tatakforms_attendance (student_id, event_id, ${columnName}) VALUES (?, ?, ?)`
          
          // Insert attendance
          const updateResult = await db.query<MariaUpdateResult>(
            query, [data.studentId, data.event.id, data.dateStamp]
          );

          // Resolve promise
          if (updateResult.affectedRows > 0) {
            Log.i(`✅ [TATAKFORM] [ATTENDANCE] [${data.studentId}] ${TatakFormAttendance.mapDayName(columnName)}`);
            resolve(`Student (${data.studentId}) has attended for ${TatakFormAttendance.mapDayName(columnName)}.`);

            // Send to socket client
            TatakFormAttendance.sendToSocketClients(data.collegeId, data.event.slug);
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
  public static getStudentsAttendedByEventAndCollege(eventId: number, collegeId: number) {
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
            a.student_id = s.student_id AND event_id = ? and c.college_id = ?
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
  public static getStudentCountAttendedBySlugAndCollege(eventSlug: string, collegeId: number, willBaseOnDay?: boolean) {
    return new Promise(async (resolve, reject) => {
      // Get database instance
      const db = Database.getInstance();
      // Current day value
      let day: Days | EventStatus = EventStatus.NOT_ACCEPTING;

      // If will base on day
      if (willBaseOnDay) {
        // Get current day
        day = TatakFormAttendance.getCurrentDay(await Tatakform.getBySlug(eventSlug));

        // Switch current day
        switch (day) {
          case EventStatus.NOT_ACCEPTING:
          case EventStatus.NOT_YET_OPEN:
          case EventStatus.ALREADY_CLOSED:
            return resolve(-1);
        }
      }
      

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
            a.student_id = s.student_id AND t.slug = ? and c.college_id = ? ${day ? `AND ${day} IS NOT NULL` : ""}
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
   * Get current day and return message
   */
  private static getCurrentDay(event: TatakformModel, dateStamp?: string): Days | EventStatus {
    // Get current date
    const currentDate = dateStamp ? new Date(dateStamp) : new Date();
    // Get from date
    const fromDate = new Date(event.from_date);
    // Get to date
    const toDate = new Date(event.to_date);
    toDate.setDate(toDate.getDate() + 1);

    // If event is not yet open
    if (currentDate < fromDate) return EventStatus.NOT_YET_OPEN;
    // If event is already closed
    if (currentDate >= toDate) return EventStatus.ALREADY_CLOSED;

    // AM START
    const AM_START_HOUR = 8;
    // AM END
    const AM_END_HOUR = 12;
    // PM START
    const PM_START_HOUR = 13;
    // PM END
    const PM_END_HOUR = 17;

    // Get day difference
    const dayDifference = Math.floor((currentDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
    // Get current day
    const currentDay = dayDifference + 1;
    // Get current hour
    const currentHour = currentDate.getHours();

    // If between AM start and AM end
    if (currentHour >= AM_START_HOUR && currentHour < AM_END_HOUR ) {
      // Switch current day
      switch (currentDay) {
        case 1:
          return Days.DAY1AM;
        case 2:
          return Days.DAY2AM;
        case 3:
          return Days.DAY3AM;
      }
    }

    // If between PM start and PM end
    if (currentHour >= PM_START_HOUR && currentHour < PM_END_HOUR) {
      // Switch current day
      switch (currentDay) {
        case 1:
          return Days.DAY1PM;
        case 2:
          return Days.DAY2PM;
        case 3:
          return Days.DAY3PM;
      }
    }

    // Event not yet accepting attendance
    return EventStatus.NOT_ACCEPTING;
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
