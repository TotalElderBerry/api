import type { ElysiaContext, ResponseBody } from "../../types";
import { EmailType, ErrorTypes } from "../../types/enums";
import { status501 } from "../../routes";
import { sendEmail } from "../../utils/email";

import TatakFormStudent from "../../db/models/tatakform/student";
import response from "../../utils/response";
import Strings from "../../config/strings";
import Log from "../../utils/log";
import Config from "../../config";

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
 * GET /tatakforms/students/
 * GET /tatakforms/students/:studentId
 * GET /tatakforms/reset/:token
 */
async function getStudents(context: ElysiaContext) {
  // Get studentId from context
  const { studentId } = context.params || {};

  try {
    // If for reset password
    if (context.path.includes("/reset")) {
      return getReset(context);
    }

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
 * POST /tatakforms/student/forgot
 * POST /tatakforms/student/reset
 */
async function postStudents(context: ElysiaContext) {
  try {

    // If for registration
    if (context.path.endsWith("/register")) {
      // Insert student
      await TatakFormStudent.insert(context.body);
      // If no error, student is created
      return response.success("You have successfully registered! 💛");
    }

    // If for reset password
    if (context.path.endsWith("/reset")) {
      // Reset password
      return resetPassword(context);
    }

    // If for forgot password
    if (context.path.endsWith("/forgot")) {
      // Get student id from request body
      const { student_id } = context.body;

      // If student ID is not present
      if (!student_id) {
        context.set.status = 400;
        return response.error("Student ID is required.");
      }

      // Send forgot password email
      await TatakFormStudent.forgotPassword(student_id);
      // If no error, email is sent
      return response.success("Your tatakform reset password email is on the way!");
    }
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

/**
 * GET /tatakforms/reset/:token
 */
async function getReset(context: ElysiaContext) {
  // Get token param
  const { token } = context.params || {};

  if (!token) {
    context.set.status = 400;
    return response.error(Strings.RESET_PASSWORD_EMPTY_TOKEN);
  }

  if (token.length !== Config.TOKEN_LENGTH) {
    context.set.status = 400;
    return response.error(Strings.RESET_PASSWORD_INVALID_TOKEN);
  }

  try {
    // Search student from token
    await TatakFormStudent.fromResetToken(token);
    // Return success if no errors
    return response.success();
  }

  catch (error) {
    if (error === ErrorTypes.DB_ERROR) {
      context.set.status = 500;
      return response.error(Strings.GENERAL_SYSTEM_ERROR);      
    }

    if (error === ErrorTypes.DB_EMPTY_RESULT) {
      context.set.status = 400;
      return response.error(Strings.RESET_PASSWORD_INVALID_TOKEN);
    }

    if (error === ErrorTypes.DB_USED) {
      context.set.status = 400;
      return response.error(Strings.RESET_PASSWORD_TOKEN_USED);
    }

    if (error === ErrorTypes.DB_EXPIRED) {
      context.set.status = 400;
      return response.error(Strings.RESET_PASSWORD_EXPIRED);
    }
  }
}

/**
 * POST /tatakforms/student/reset
 */
async function resetPassword(context: ElysiaContext) {
   // Get token and new password from request
   const { token, new_password } = context.body || {};

   if (!token) {
     context.set.status = 400;
     return response.error(Strings.RESET_PASSWORD_EMPTY_TOKEN);
   }
 
   if (token.length !== Config.TOKEN_LENGTH) {
     context.set.status = 400;
     return response.error(Strings.RESET_PASSWORD_INVALID_TOKEN);
   }
 
   if (!new_password) {
     context.set.status = 400;
     return response.error(Strings.RESET_PASSWORD_EMPTY_PASSWORD);
   }
 
   if (new_password.trim().length < 8) {
     context.set.status = 400;
     return response.error(Strings.RESET_PASSWORD_LIMIT_PASSWORD);
   }

   try {
    // Update password
    const student = await TatakFormStudent.updatePasswordFromToken(token, new_password.trim());

    // Send email
    sendEmail({
      type: EmailType.RESET_PASSWORD,
      to: student.email_address,
      subject: Strings.RESET_PASSWORD_EMAIL_SUCCESS_SUBJECT,
      title: Strings.RESET_PASSWORD_EMAIL_SUCCESS_TITLE,
      data: {
        name: `${student.first_name} ${student.last_name}`
      }
    });

    // Return success if no errors
    return response.success(Strings.RESET_PASSWORD_SUCCESS);
  }

  catch (error) {
    if (error === ErrorTypes.DB_ERROR) {
      context.set.status = 500;
      return response.error(Strings.GENERAL_SYSTEM_ERROR);      
    }

    if (error === ErrorTypes.DB_EMPTY_RESULT) {
      context.set.status = 400;
      return response.error(Strings.RESET_PASSWORD_INVALID_TOKEN);
    }

    if (error === ErrorTypes.DB_USED) {
      context.set.status = 400;
      return response.error(Strings.RESET_PASSWORD_TOKEN_USED);
    }

    if (error === ErrorTypes.DB_EXPIRED) {
      context.set.status = 400;
      return response.error(Strings.RESET_PASSWORD_EXPIRED);
    }
  }
}