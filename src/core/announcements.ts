import type { Request, Response } from "express";
import { ErrorTypes } from "../types/enums";
import { result } from "../utils/response";
import { isNumber } from "../utils/string";
import Strings from "../config/strings";
import Announcement from "../db/models/announcement";

/**
 * Tutorials API
 * @author TotalElderBerry (Brian Keith Lisondra)
 * @author mavyfaby (Maverick Fabroa)
 * 
 * @param request Express request object
 * @param response Express response object
 */
export function announcements(request: Request, response: Response) {
  // Map methods
  switch (request.method) {
    case 'GET':
      getAnnouncements(request, response);
      break;
    case 'POST':
      addAnnouncement(request, response);
      break;
    case 'PUT':
      updateAnnouncement(request, response);
      break;
    case 'DELETE':
      deleteAnnouncement(request, response);
      break;
  }
}

/**
 * GET /announcements
 */
export function getAnnouncements(request: Request, response: Response) {
  // Get academic year
  const { academic_year } = request.params;

  // If using year
  if (academic_year) {
    // If academic_year is not a number
    if (!isNumber(academic_year)) {
      response.status(404).send(result.error(Strings.ANNOUNCEMENTS_INVALID_ACADEMIC_YEAR));
      return;
    }

    // Get announcements by academic_year
    getAnnouncementsByAcademicYear(parseInt(academic_year), response);
    return
  }

  // Get all students
  Announcement.find(request.query, (error, announcements, count) => {
    if (error === ErrorTypes.DB_ERROR) {
      response.status(500).send(result.error(Strings.GENERAL_SYSTEM_ERROR));
      return;
    }

    if (error === ErrorTypes.DB_EMPTY_RESULT) {
      response.status(200).send(result.error(Strings.ANNOUNCEMENTS_NOT_FOUND));
      return;
    }

    if (error === ErrorTypes.REQUEST_KEY_NOT_ALLOWED) {
      response.status(400).send(result.error(Strings.GENERAL_COLUMN_NOT_FOUND));
      return;
    } 

    response.status(200).send(result.success(Strings.ANNOUNCEMENTS_FOUND, announcements, count));
  });
}

/**
 * GET /announcements/:academic_year
 */
export function getAnnouncementsByAcademicYear(year: number, response: Response) {
  // Get tutorials by academic year
  Announcement.fromAcademicYear(year, (error, announcements) => {
    // If has error
    if (error === ErrorTypes.DB_ERROR) {
      response.status(500).send(result.error(Strings.ANNOUNCEMENTS_GET_ERROR));
      return;
    }

    // If no results
    if (error === ErrorTypes.DB_EMPTY_RESULT) {
      response.status(404).send(result.error(Strings.ANNOUNCEMENTS_NOT_FOUND));
      return;
    }

    // Return the events
    return response.send(result.success(Strings.ANNOUNCEMENTS_FOUND, announcements));
  })
}

/**
 * POST /announcements 
 */
export function addAnnouncement(request: Request, response: Response) {
  // Validate data
  const error = Announcement.validate(request.body);

  // If has an error
  if (error) {
    response.status(400).send(result.error(error[0], error[1]));
    return;
  }

  // Add announcement to database
  Announcement.insert(request.body, request.files, (error, announcement) => {
    // If has error
    if (error === ErrorTypes.DB_ERROR) {
      response.status(500).send(result.error(Strings.ANNOUNCEMENT_POST_ERROR));
      return;
    }

    // If success, return announcement
    response.send(result.success(Strings.ANNOUNCEMENT_POST_SUCCESS, announcement));
  });
}

/**
 * PUT /announcements/:id 
 */
export function updateAnnouncement(request: Request, response: Response) {
  // Get announcement ID
  const { id } = request.params;

  // If id is not a number
  if (!isNumber(id)) {
    response.status(404).send(result.error(Strings.GENERAL_INVALID_REQUEST));
    return;
  }

  // Update announcement
  Announcement.update(parseInt(id), request.body, request.files, error => {
    if (error === ErrorTypes.DB_ERROR) {
      response.status(500).send(result.error(Strings.ANNOUNCEMENT_UPDATE_ERROR));
      return;
    }

    if (error === ErrorTypes.DB_EMPTY_RESULT) {
      response.status(404).send(result.error(Strings.ANNOUNCEMENT_NOT_FOUND));
      return;
    }

    response.send(result.success(Strings.ANNOUNCEMENT_UPDATE_SUCCESS));
  })
}

/**
 * DELETE /announcements/:id 
 */
export function deleteAnnouncement(request: Request, response: Response) {
  const { id } = request.params;

  if (!id) {
    response.status(404).send(result.error(Strings.GENERAL_INVALID_REQUEST));
    return;
  }

  // Delete announcement
  Announcement.delete(parseInt(id), (error, success) => {
    if (success) {
      response.send(result.success(Strings.ANNOUNCEMENT_DELETE_SUCCESS))
      return
    }

    response.send(result.error(Strings.ANNOUNCEMENT_DELETE_ERROR))
  })
}

