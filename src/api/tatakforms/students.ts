import type { ElysiaContext, ResponseBody } from "../../types";
import { ErrorTypes } from "../../types/enums";
import { status501 } from "../../routes";

import TatakFormStudent from "../../db/models/tatakform/student";
import response from "../../utils/response";
import Strings from "../../config/strings";
import Log from "../../utils/log";

/**
 * Students API
 * @author TotalElderBerry (Unknown af)
 * @author mavyfaby (Maverick Fabroa)
 * @param context
 */
export function students(context: ElysiaContext): Promise<ResponseBody | undefined> | ResponseBody {
  switch (context.request.method) {
    case "GET":
      return getStudents(context);
    case "POST":
      return postStudents(context);
    case "OPTIONS":
      return response.success();
  }

  return status501(context);
}

/**
 * GET /tatakforms/students/(:studentId)
 */
async function getStudents(context: ElysiaContext) {
  // Get studentId from context
  const { studentId } = context.params || {};

  try {
    // If studentId is not provided, return empty data
    if (!studentId) return response.error("No student found.", {});
    // If studentId is provided, return student by studentId
    const student = await TatakFormStudent.getByStudentId(studentId);
    // Return student
    return response.success(student);
  }

  catch (error) {
    context.set.status = 500;
    return response.error(error);
  }
}

/**
 * POST /tatakforms/register
 */
async function postStudents(context: ElysiaContext) {
  try {
    // Insert student
    await TatakFormStudent.insert(context.body);
    // If no error, student is created
    return response.success("You have successfully registered! 💛");
  }
  
  catch (error) {
    // if list of errors
    if (Array.isArray(error)) {
      context.set.status = 400;
      return response.error(error[0], error[1]);
    }

    // If database error
    if (error === ErrorTypes.DB_ERROR) {
      context.set.status = 500;
      return response.error(Strings.STUDENT_POST_ERROR);
    }

    // If unknown error
    Log.e(error);
    context.set.status = 500;
    return response.error(Strings.GENERAL_SYSTEM_ERROR);
  }
}