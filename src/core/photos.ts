import type { Response, Request } from "express";
import { result } from "../utils/response";
import { ErrorTypes } from "../types/enums";
import { isNumber } from "../utils/string";
import { Photo } from "../db/models/photo";
import { PhotoType } from "../types/models";
import { getPattern } from "../utils/route";

import {
  PHOTO_CREATED, PHOTO_POST_ERROR, PHOTO_FOUND,
  PHOTO_NOT_FOUND, PHOTO_GET_ERROR, PHOTO_INVALID_ID
} from "../strings/strings.json";

/**
 * Photos API
 * @author mavyfaby (Maverick Fabroa)
 * 
 * @param request Express request
 * @param response Express response
 */
export function photos(request: Request, response: Response) {
  switch (request.method) {
    case 'GET':
      getPhotos(request, response);
      break;
    case 'POST':
      postPhotos(request, response);
  }
}

/**
 * GET /photos
 * 
 * @param request Express request
 * @param response Express response
 */
function getPhotos(request: Request, response: Response) {
  // Get {id} from request parameters
  const { id } = request.params;

  // If has an id, call `getPhoto` function instead
  if (id) {
    getPhoto(request, response);
    return;
  }

  // TODO: Get the photo ID's from the database
}

/**
 * GET /photos/:id
 * 
 * @param request Express request
 * @param response Express response
 */
function getPhoto(request: Request, response: Response) {
  // Get {id} from request parameters
  const { id } = request.params;
  // Is raw?
  const isRaw = getPattern(request.originalUrl)?.endsWith("raw");

  // If {id} is not a number
  if (!isNumber(id)) {
    response.status(400).send(result.error(PHOTO_INVALID_ID));
    return;
  }

  // Get the photo from the database
  Photo.fromId(Number(id), (error, photo) => {
    // If has an error
    if (error === ErrorTypes.DB_ERROR) {
      response.status(500).send(result.error(PHOTO_GET_ERROR));
      return;
    }
    
    // If no results
    if (error === ErrorTypes.DB_EMPTY_RESULT || photo === null) {
      response.status(404).send(isRaw ? '' : result.error(PHOTO_NOT_FOUND));
      return;
    }

    // Get photo data
    const data = photo.getData();

    // If using the raw route
    if (isRaw) {
      // Send the photo data  
      return response
        .setHeader('Content-Type', photo.getType())
        .setHeader('Content-Length', data.length)
        .end(data);
    }

    // Ohterwise, return the photo data
    response.send(result.success(PHOTO_FOUND, {
      ...photo,
      data: data.toString('base64')
    }));
  });
}

/**
 * POST /photos
 * @param request 
 * @param response 
 */
function postPhotos(request: Request, response: Response) {
  // Validate the student data
  const error = Photo.validate(request.body);

  // If has an error
  if (error) {
    response.status(400).send(result.error(error[0], error[1]));
    return;
  }

  // Get request body and convert the base64 data to buffer
  const photo: PhotoType = {
    ...request.body,
    data: Buffer.from(request.body.data, 'base64')
  };

  // Insert the student to the database
  Photo.insert(photo, (error, photo) => {
    // If has an error
    switch (error) {
      case ErrorTypes.DB_ERROR:
        response.status(500).send(result.error(PHOTO_POST_ERROR));
        return;
    }

    // Otherwise, return the student data
    response.send(result.success(PHOTO_CREATED));
  });
}