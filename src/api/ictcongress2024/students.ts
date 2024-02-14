import { status501 } from "../../routes";
import { ElysiaContext, ResponseBody } from "../../types";
import response from "../../utils/response";
import Strings from "../../config/strings";

import Admin from "../../db/models/ictcongress2024/admin";
import { PaginationOutput } from "../../types/request";
import { ErrorTypes } from "../../types/enums";

/**
 * ICT Congress Students API
 * @author mavyfaby (Maverick Fabroa)
 */
export function students(context: ElysiaContext): Promise<ResponseBody | undefined> | ResponseBody  {
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
 * GET /ictcongress2024/students
 * @param context Elysia context
 */
async function getStudents(context: ElysiaContext) {
  if (!!context.query) {
    try {
      const students = await Admin.searchStudents(context.user.campus_id, context.query as PaginationOutput);
      // console.log(students);
      return response.success(Strings.STUDENTS_FOUND, ...students);
    }

    catch (e) {
      if (e == ErrorTypes.DB_EMPTY_RESULT) {
        return response.error("No students found");
      }

      return response.error();
    }
  }

  return response.success();
}

/**
 * POST /ictcongress2024/students/:student_id/(present|payment-confirm)
 * @param context Elysia context
 */
async function postStudents(context: ElysiaContext) {
  const isPresent = context.path.includes("present");
  const isPaymentConfirm = context.path.includes("payment-confirm");
  const student_id = context.params?.student_id;

  // Check for student ID when accessing /present or /confirm
  if (!student_id && (isPresent || isPaymentConfirm)) {
    return response.error("Student ID is required");
  }

  // If confirming payment for student
  if (isPaymentConfirm) {
    try {
      await Admin.confirmPaymentByStudentID(student_id!);
      return response.success("Payment successfully confirmed!");
    } catch (e) {
      return response.error(e);
    }
  }

  // If marking student as present
  if (isPresent) {
    return;
  }

  // Register student
  try {
    await Admin.registerStudent(await context.body);
    return response.success("You have successfully registered! Please check your email for your order confirmation. 💛");
  } catch (e) {
    console.error(e);
    return response.error(e);
  }
}