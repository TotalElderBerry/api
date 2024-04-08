import Database from "../..";
import Log from "../../../utils/log";

type TatakformAdminType = {
  id: number;
  college_id: number;
  student_id: string;
  first_name: string;
  last_name: string;
  username: string;
  password: string;
};

/**
 * Tatakform Admin Model
 * @author TotalElderBerry (lala)
 */
class TatakFormAdmin {
  /**
   * Get by username and password
   */
  public static getByUsernameAndPassword(username: string, password: string): Promise<TatakformAdminType> {
    return new Promise(async (resolve, reject) => {
      // Get database instance
      const db = Database.getInstance();

      try {
        // Get admin by username and password
        const result = await db.query<TatakformAdminType[]>(
          `SELECT
            s.id, s.student_id, s.last_name, s.first_name, s.year_level, s.email_address, s.password, s.date_stamp, s.course_id, c.college_id, co.acronym, co.name
          FROM
            tatakforms_admin a
          INNER JOIN
            tatakforms_students s ON s.id = a.tatakforms_students_id
          INNER JOIN
            colleges_courses c ON c.id = s.course_id
          INNER JOIN
            colleges co ON co.id = c.college_id
          WHERE
            s.student_id = ?
          `, [username]
        );

        // If no result or password is incorrect
        if (result.length === 0 || !(await Bun.password.verify(password, result[0].password))) {
          return reject("Username or password is incorrect");
        }

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
   * Get by username
   */
  public static getByUsername(username: string): Promise<TatakformAdminType> {
    return new Promise(async (resolve, reject) => {
      // Get database instance
      const db = Database.getInstance();

      try {
        // Get admin by username
        const result = await db.query<TatakformAdminType[]>(
          `SELECT
            s.id, s.student_id, s.last_name, s.first_name, s.year_level, s.email_address, s.password, s.date_stamp, s.course_id, co.acronym, co.name
          FROM
            tatakforms_admin a
          INNER JOIN
            tatakforms_students s ON s.id = a.tatakforms_students_id
          INNER JOIN
            colleges_courses c ON c.id = s.course_id
          INNER JOIN
            colleges co ON co.id = c.college_id
          WHERE
            s.student_id = ?
          `, [username]
        );
       
        if (result.length === 0) {
          return reject("Tatakform admin doesn't exist.");
        }

        resolve(result[0]);
      }

      // Log error and reject promise
      catch (e) {
        Log.e(e);
        reject(e);
      }
    });
  }
}

export default TatakFormAdmin;