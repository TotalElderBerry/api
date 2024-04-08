import type { ElysiaContext, ResponseBody } from "../../types";
import { createSessionToken } from "../../utils/security";
import { status501 } from "../../routes";
import { AuthType } from "../../types/enums";
import response from "../../utils/response";
import Strings from "../../config/strings";

import Log from "../../utils/log";
import TatakFormAdmin from "../../db/models/tatakform/admin";

/**
 * Tatakforms Admin Login API
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
 * POST /tatakforms/admin/login
 * @param context Elysia context
 */
async function postLogin(context: ElysiaContext) {
  // Get request data
  let { username, password } = context.body || {};

  // If student_id is not specified
  if (!username) {
    context.set.status = 400;
    return response.error("Username is required");
  }

  // If password is not specified
  if (!password) {
    context.set.status = 400;
    return response.error("Password is required");
  }

  try {
    // Get admin
    const admin = await TatakFormAdmin.getByUsernameAndPassword(username.trim(), password);
    // Data to be stored in the token
    const data = { role: AuthType.TATAKFORM_ACCOUNT_ADMIN, ...admin };
    // Create access token (1 day)
    const accessToken = await createSessionToken(false, data, "1d");
    // Create refresh token (15 days)
    const refreshToken = await createSessionToken(true, data, "15d");

    // Log the login
    Log.login({
      student_id: admin.student_id,
      type: data.role,
      name: `${admin.first_name} ${admin.last_name}`,
      students_id: admin.id,
    });

    // Remove password from user
    delete username.password;
    // Return success
    return response.success(Strings.LOGIN_SUCCESS, { data, accessToken, refreshToken });
  }

  catch (error) {
    Log.e(error);
    return response.error(error);    
  }
}
