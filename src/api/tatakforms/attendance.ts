import type { ElysiaContext, ResponseBody } from "../../types";
import { ErrorTypes } from "../../types/enums";
import { status501 } from "../../routes";

import TatakFormStudent from "../../db/models/tatakform/student";
import response from "../../utils/response";
import Strings from "../../config/strings";
import Attendance from "../../db/models/tatakform/attendance";
import Tatakform from "../../db/models/tatakform";

/**
 * Tatakform Attendance API
 * @author TotalElderBerry (Unknown af)
 * @param context
 */
export function attendance(context: ElysiaContext): Promise<ResponseBody | undefined> | ResponseBody {
  switch (context.request.method) {
    case "GET":
      if (context.params?.eventId) {
        return getAllStudentsAttended(context);
      }

      return getAttendance(context);
    case "POST":
      return postAttendance(context);
    case "OPTIONS":
      return response.success();
  }

  return status501(context);
}

/**
 * POST /tatakforms/attendance/:slug
 * Mark student as present in specific day
 */
async function postAttendance(context: ElysiaContext) {
  try {
    const slug = context.params?.slug;
    if (slug) {
      const tatak_event = await Tatakform.getBySlug(slug);
      const student = await TatakFormStudent.getByStudentId(context.body.student_id);

      if (tatak_event) {
        await Attendance.attendStudent(context.body.student_id, tatak_event);
      }

      return response.success("Attended successfully", { student_id: context.body.student_id });
    }
  } catch (error) {
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

    return response.error(error)
  }
}

/**
 * GET /tatakforms/attendance/
 * Fetches the attedance history of a student in all events
 * 
 * GET /tatakforms/attendance/:slug
 * Fetches the attedance history of a student in an event
 * @param context
 * 
 */
async function getAttendance(context: ElysiaContext) {
  try {
    // Get slug
    const slug = context.params?.slug;

    // If slug is specified
    if (slug) {
      // Get event by slug
      const tatakform = await Tatakform.getBySlug(slug);
      // Get attendance history by event
      const attendance = await Attendance.getAttendanceByEvent(context.user?.student_id, tatakform.id);
      
      // Return response
      return response.success("Fetch Successful", attendance);
    }

    // Otherwise, get all attendance history
    const history = await Attendance.getAttendance(context.user?.student_id);
    return response.success("Fetch Successful", history);
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
      return response.error("Fetching Attendance Error");
    }

    return response.error(error)
  }
}

/**
 * GET /tatakforms/attendance/event/:eventId
 * Get all students attendance by event and college
 */
async function getAllStudentsAttended(context: ElysiaContext) {
  try {
    // Get event id
    const eventId = context.params?.eventId;

    // If event id is specified
    if (eventId) {
      // Get all students attended by event and college
      const attendance = await Attendance.getStudentsAttendedByEventAndCollege(eventId, context.user.college_id);
      return response.success("Success", attendance)
    }
  }
  
  catch (error) {
    return response.error(error)
  }
}
