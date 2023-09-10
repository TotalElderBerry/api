import type { Request, Response } from "express";

import { result } from "../utils/response";
import { AuthType, ErrorTypes } from "../types/enums";
import { Order } from "../db/models/order";
import { isObjectEmpty } from "../utils/string";
import Strings from "../config/strings";

/**
 * Orders API
 * @author mavyfaby (Maverick Fabroa)
 * 
 * @param request Express Request Object
 * @param response Express Response Object
 */
export function orders(request: Request, response: Response) {
  // Map request method
  switch (request.method) {
    case 'GET':
      getOrders(request, response);
      break;
    case 'POST':
      postOrders(request, response);
      break;
    case 'PUT':
      putOrders(request, response);
      break;
  }
}

/**
 * GET /orders
 */
export function getOrders(request: Request, response: Response) {
  // Get order ID from request params
  const { id, receipt, studentId } = request.params;

  // If has receipt
  if (receipt) {
    // If has student ID
    if (studentId) {
      // Get order
      Order.fromReceiptAndStudent(receipt, studentId, (error, order) => {
        if (error === ErrorTypes.DB_ERROR) {
          response.status(500).send(result.error(Strings.GENERAL_SYSTEM_ERROR));
          return;
        }

        if (error === ErrorTypes.DB_EMPTY_RESULT) {
          response.status(404).send(result.error(Strings.ORDER_NOT_FOUND));
          return;
        }

        response.status(200).send(result.success(Strings.ORDER_FOUND, order));
      });

      return;
    }

    // Get order
    Order.fromReceipt(receipt, (error, order) => {
      if (error === ErrorTypes.DB_ERROR) {
        response.status(500).send(result.error(Strings.GENERAL_SYSTEM_ERROR));
        return;
      }

      if (error === ErrorTypes.DB_EMPTY_RESULT) {
        response.status(404).send(result.error(Strings.ORDER_NOT_FOUND));
        return;
      }

      response.status(200).send(result.success(Strings.ORDER_FOUND, order));
    });

    return;
  }

  // If order ID is present
  if (id) {
    getOrder(request, response);
    return;
  }

  // If auth type is student
  if (response.locals.role === AuthType.STUDENT) {
    // Get student ID from response locals
    const { studentID } = response.locals;

    // If student ID is not present
    if (!studentID) {
      // Return error
      response.status(400).send(result.error(Strings.GENERAL_INVALID_REQUEST));
      return;
    }

    const cols = JSON.parse(request.query.search_column as string);
    const vals = JSON.parse(request.query.search_value as string);

    // add student ID to cols
    cols.unshift('*student_id');
    // add student ID to vals
    vals.unshift(studentID);

    // Set search column and value
    request.query.search_column = JSON.stringify(cols);
    request.query.search_value = JSON.stringify(vals);
  }

  // Get all orders
  Order.find(request.query, (error, orders, count) => {
    if (error === ErrorTypes.DB_ERROR) {
      response.status(500).send(result.error(Strings.GENERAL_SYSTEM_ERROR));
      return;
    }

    if (error === ErrorTypes.DB_EMPTY_RESULT) {
      response.status(200).send(result.error(Strings.ORDERS_EMPTY));
      return;
    }

    if (error === ErrorTypes.REQUEST_KEY_NOT_ALLOWED) {
      response.status(400).send(result.error(Strings.GENERAL_COLUMN_NOT_FOUND));
      return;
    }

    response.status(200).send(result.success(Strings.ORDERS_FOUND, orders, count));
  });
}

/**
 * GET /orders/:id 
 */
export function getOrder(request: Request, response: Response) {
  // Get order ID from request params
  const { id } = request.params;

  // If order ID is not present
  if (!id) {
    // Return error
    response.status(400).send(result.error(Strings.ORDER_INVALID_ID));
    return;
  }

  // Otherwise, get order
  Order.fromId(id, (error, order) => {
    // If has an error
    if (error === ErrorTypes.DB_ERROR) {
      response.status(500).send(result.error(Strings.GENERAL_SYSTEM_ERROR));
      return;
    }

    // If no results
    if (error === ErrorTypes.DB_EMPTY_RESULT) {
      response.status(404).send(result.error(Strings.ORDER_NOT_FOUND));
      return;
    }

    // Otherwise, send order
    response.status(200).send(result.success(Strings.ORDER_FOUND, order));
  });
}

/**
 * POST /orders
 */
export function postOrders(request: Request, response: Response) {
  // Is logged in?
  const isLoggedIn = !!response.locals.studentID;
  // Validate order data
  const errors = Order.validate(request.body, isLoggedIn, request.files);

  // If has an error
  if (errors){
    response.status(400).send(result.error(errors[0], errors[1]));
    return;
  }

  // Otherwise, insert order
  Order.insert(response.locals.studentID, request.body, request.files || null, (error, receiptID) => {
    // If has an error
    if (error === ErrorTypes.DB_ERROR) {
      response.status(500).send(result.error(Strings.ORDER_POST_ERROR));
      return;
    }

    // If no photo/proof
    if (error === ErrorTypes.REQUEST_FILE) {
      response.status(500).send(result.error(Strings.ORDER_EMPTY_PROOF));
      return;
    }

    // Send email
    Order.sendEmail(receiptID!);
    // Otherwise, return the product data
    response.send(result.success(Strings.ORDER_CREATED, receiptID));
  });
}

/**
 * PUT /orders/:id/:key 
 */
export function putOrders(request: Request, response: Response) {
  // Get order ID from request params
  const { id, key } = request.params;
  // Get value from request body
  const { value } = request.body;

  // If request body and value is empty
  if (isObjectEmpty(request.body) || !request.body.value) {
    // Return error
    response.status(400).send(result.error(Strings.GENERAL_INVALID_REQUEST));
    return;
  }

  // Update order
  Order.update(id, key, value, (error, success) => {
    // IF has an error
    if (error === ErrorTypes.DB_ERROR) {
      response.status(500).send(result.error(Strings.GENERAL_SYSTEM_ERROR));
      return;
    }

    // if id is empty
    if (error === ErrorTypes.REQUEST_ID) {
      response.status(400).send(result.error(Strings.ORDER_INVALID_ID));
      return;
    }

    // if key is empty
    if (error === ErrorTypes.REQUEST_KEY) {
      response.status(400).send(result.error(Strings.ORDER_INVALID_KEY));
      return;
    }

    // if key is not allowed
    if (error === ErrorTypes.REQUEST_KEY_NOT_ALLOWED) {
      response.status(400).send(result.error(Strings.GENERAL_KEY_NOT_ALLOWED));
      return;
    }

    // If order not found
    if (error === ErrorTypes.DB_EMPTY_RESULT) {
      response.status(404).send(result.error(Strings.ORDER_NOT_FOUND));
      return;
    }

    // If not success
    if (!success) {
      response.status(400).send(result.error(Strings.ORDER_UPDATE_ERROR));
      return;
    }

    // Otherwise, return success
    response.status(200).send(result.success(Strings.ORDER_UPDATED));
  });
}