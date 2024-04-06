import type { ElysiaContext, ResponseBody } from "../../types";
import { createSessionToken } from "../../utils/security";
import { status501 } from "../../routes";
import { AuthType } from "../../types/enums";
import response from "../../utils/response";
import Strings from "../../config/strings";

import TatakFormStudent from "../../db/models/tatakform/student";
import Log from "../../utils/log";

/**
 * UC Days Login API
 * @author TotalElderBerry (huhu)
 */
export function login(context: ElysiaContext): Promise<ResponseBody | undefined> | ResponseBody  {
  switch (context.request.method) {
    case "POST":
      return postLogin(context);
    case "OPTIONS":
      return response.success();
  }

  return status501(context);
}


/**
 * POST /tatakforms/login
 * @param context Elysia context
 */
async function postLogin(context: ElysiaContext) {
  // Get request data
  let { student_id, password } = context.body || {};

  // If student_id is not specified
  if (!student_id) {
    context.set.status = 400;
    return response.error("Student ID is required");
  }

  // If password is not specified
  if (!password) {
    context.set.status = 400;
    return response.error("Password is required");
  }

  try {
    // Get student
    const student = await TatakFormStudent.getByStudentId(student_id.trim());

    // Compare password
    if (!(await Bun.password.verify(password, student.password || ""))) {
      context.set.status = 404;
      return response.error(Strings.LOGIN_FAILED);
    }
  
    // Data to be stored in the token
    const data = { role: AuthType.UNIV_ACCOUNT, ...student };
    // Create access token (1 day)
    const accessToken = await createSessionToken(false, data, "1d");
    // Create refresh token (15 days)
    const refreshToken = await createSessionToken(true, data, "15d");

    // Log the login
    Log.login({
      student_id: student.student_id,
      type: data.role,
      name: `${student.first_name} ${student.last_name}`,
      students_id: student.id,
    });

    // Remove password from user
    delete data.password;
    // Return success
    return response.success(Strings.LOGIN_SUCCESS, { data, accessToken, refreshToken });
  }

  catch (error) {
    Log.e(error);
    return response.error(error);    
  }
}
