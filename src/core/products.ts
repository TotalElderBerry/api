import { Request, Response } from 'express';
import { AuthType, ErrorTypes } from '../types/enums';
import { result } from '../utils/response';
import { isNumber } from '../utils/string';
import Product from '../db/models/product';
import Strings from "../config/strings";

/**
 * Products API
 * @author ampats04 (Jeremy Andy F. Ampatin)
 * @author mavyfaby (Maverick G. Fabroa)
 * 
 * @param request Exprese request
 * @param response Express response
 */
export function products(request: Request, response: Response) {
  switch (request.method) {
    case 'GET':
      getProducts(request, response);
      break;
    case 'POST':
      postProducts(request, response);
      break;
    case 'PUT':
      updateProduct(request, response);
      break;
  }
}

/**
 * GET /products
 * 
 * @param request Express Request Object
 * @param response Express Response Object
 */
function getProducts(request: Request, response: Response) {
  // Get {id} from request parameters
  const { id } = request.params;

  // If has an id, call `getProduct` function instead
  if (id) {
    getProduct(request, response);
    return;
  }

  // Get all students
  Product.find(request.query, (error, students, count) => {
    if (error === ErrorTypes.DB_ERROR) {
      response.status(500).send(result.error(Strings.GENERAL_SYSTEM_ERROR));
      return;
    }

    if (error === ErrorTypes.DB_EMPTY_RESULT) {
      response.status(200).send(result.error(Strings.PRODUCTS_NOT_FOUND));
      return;
    }

    if (error === ErrorTypes.REQUEST_KEY_NOT_ALLOWED) {
      response.status(400).send(result.error(Strings.GENERAL_COLUMN_NOT_FOUND));
      return;
    }

    response.status(200).send(result.success(Strings.PRODUCTS_FOUND, students, count));
  });
}

/**
 * GET /products/:id
 * 
 * @param request Express Request Object
 * @param response Express Response Object
 */
function getProduct(request: Request, response: Response) {
  // Get the product ID
  const { id } = request.params;

  // If id is not a number, return student not found
  if (!isNumber(id)) {
    response.status(404).send(result.error(Strings.PRODUCT_NOT_FOUND));
    return;
  }

  // Get the product by its ID
  Product.fromId(parseInt(id), (error, product) => {
    // If has an error
    if (error === ErrorTypes.DB_ERROR) {
      response.status(500).send(result.error(Strings.PRODUCT_GET_ERROR));
      return;
    }

    // If no results
    if (error === ErrorTypes.DB_EMPTY_RESULT) {
      response.status(404).send(result.error(Strings.PRODUCT_NOT_FOUND));
      return;
    }

    // Return the product
    response.send(result.success(Strings.PRODUCT_FOUND, product));
  });
}

/**
 * POST /products
 * 
 * @param request 
 * @param response 
 */
function postProducts(request: Request, response: Response) {
  // Validate the product data
  const validation = Product.validate(request.body, request.files);

  // If has an error
  if (validation) {
    response.status(400).send(result.error(validation[0], validation[1]));
    return;
  }

  // Insert the product to the database
  Product.insert(request.body, request.files, error => {
    // If has error
    if (error === ErrorTypes.DB_ERROR) {
      response.status(500).send(result.error(Strings.PRODUCT_POST_ERROR));
      return;
    }

    // If product already exists
    if (error === ErrorTypes.DB_PRODUCT_ALREADY_EXISTS) {
      response.status(400).send(result.error(Strings.PRODUCT_ALREADY_EXIST));
      return;
    }

    // Otherwise, return the product data
    response.send(result.success(Strings.PRODUCT_CREATED));
  });
}

/**
* PUT /products
* 
* @param request 
* @param response 
*/
function updateProduct(request: Request, response: Response) {
  // If ends with status route
  if (request.originalUrl.includes('/status')) {
    updateProductStatus(request, response);
    return;
  }

  // Validate the product data
  const validation = Product.validate(request.body, request.files, true);

  // If has an error
  if (validation) {
    response.status(400).send(result.error(validation[0], validation[1]));
    return;
  }

  const { id } = request.params;

  // If id is not a number, return student not found
  if (!isNumber(id)) {
    response.status(404).send(result.error(Strings.PRODUCT_NOT_FOUND));
    return;
  }

  // Update the student to the database
  Product.update(parseInt(id), request.body, request.files, error => {
    // If has error
    if (error === ErrorTypes.DB_ERROR) {
      response.status(500).send(result.error(Strings.PRODUCT_PUT_ERROR));
      return;
    }

    // If product already exists
    if (error === ErrorTypes.DB_PRODUCT_ALREADY_EXISTS) {
      response.status(400).send(result.error(Strings.PRODUCT_ALREADY_EXIST));
      return;
    }

    // Otherwise, return the product data
    response.send(result.success(Strings.PRODUCT_UPDATED));
  });

}

function updateProductStatus(request: Request, response: Response) {
  // Get the product ID
  const { id } = request.params;

  // If id is not a number, return student not found
  if (!isNumber(id)) {
    response.status(404).send(result.error(Strings.PRODUCT_NOT_FOUND));
    return;
  }

  // Get the product by its ID
  Product.fromId(parseInt(id), (error, product) => {
    // If has an error
    if (error === ErrorTypes.DB_ERROR) {
      response.status(500).send(result.error(Strings.PRODUCT_GET_ERROR));
      return;
    }

    // If no results
    if (error === ErrorTypes.DB_EMPTY_RESULT) {
      response.status(404).send(result.error(Strings.PRODUCT_NOT_FOUND));
      return;
    }

    // Update the product status
    product!.toggleStatus(error => {
      // If has error
      if (error === ErrorTypes.DB_ERROR) {
        response.status(500).send(result.error(Strings.PRODUCT_PUT_ERROR));
        return;
      }

      // Otherwise, return the product data
      response.send(result.success(Strings.PRODUCT_UPDATED));
    });
  });
}