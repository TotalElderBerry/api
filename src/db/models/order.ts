import type { FullOrderModel, OrderModel } from "../../types/models";
import type { FileArray } from "express-fileupload";
import { ErrorTypes, FullOrderEnum, ModeOfPayment, OrderStatus } from "../../types/enums";
import { getDatestamp, getLocalDate, getReadableDate } from "../../utils/date";
import { generateReference, generateToken, sanitize } from "../../utils/security";
import { OrderRequest, PaginationRequest } from "../../types/request";
import { PaginationQuery, paginationWrapper } from "../../utils/query";
import { OrderColumns, ProductColumns, Tables } from "../structure";
import { mapOrderStatusLabel } from "../../utils/string";
import { sendEmail } from "../../utils/smtp";
import { getFile } from "../../utils/file";
import { Log } from "../../utils/log";
import { Photo } from "./photo";

import Database, { DatabaseModel } from "../database";
import Strings from "../../config/strings";
import Product from "./product";

/**
 * Order model
 * This model represents the orders table in the database
 * @author mavyfaby (Maverick Fabroa)
 */
export class Order extends DatabaseModel {
  private id: number;
  private student_id: string;
  private products_id: number;
  private variations_id: number | null;
  private quantity: number;
  private mode_of_payment: ModeOfPayment;
  private status: OrderStatus;
  private user_remarks: string;
  private admin_remarks: string;
  private status_updated: string;
  private edit_date: string;
  private date_stamp: string;

    // TODO: Refactor this query
  private static _fullOrderQuery = `
    (
      SELECT CONCAT("B-", o.id) AS id, p.thumbnail, o.unique_id, o.reference, o.products_id, p.name AS product_name, p.price AS product_price,
        o.variations_id, pv.photos_id AS variations_photo_id, v.name AS variations_name, o.quantity, o.mode_of_payment, s.student_id,
        s.first_name, s.last_name, s.email_address, 0 AS course, s.year_level, o.status, o.user_remarks,
        o.admin_remarks, o.status_updated, o.edit_date, o.date_stamp
      FROM orders o
      INNER JOIN students s ON s.student_id = o.student_id
      INNER JOIN products p ON p.id = o.products_id
      LEFT JOIN product_variations pv ON pv.id = o.variations_id
      LEFT JOIN variations v ON v.id = pv.variations_id
    ) UNION (
      SELECT CONCAT("N-", o.id), p.thumbnail, o.unique_id, o.reference, o.products_id, p.name AS product_name, p.price AS product_price,
        o.variations_id, pv.photos_id AS variations_photo_id, v.name AS variations_name, o.quantity, o.mode_of_payment, o.student_id,
        o.first_name, o.last_name, o.email_address, o.course, o.year_level, o.status, o.user_remarks, o.admin_remarks, o.status_updated, o.edit_date, o.date_stamp
      FROM non_bscs_orders o
      INNER JOIN products p ON p.id = o.products_id
      LEFT JOIN product_variations pv ON pv.id = o.variations_id
      LEFT JOIN variations v ON v.id = pv.variations_id
    )
  `;

  /**
   * Order Private Constructor
   * @param data Order data
   */
  public constructor(data: OrderModel) {
    super();
    this.id = data.id;
    this.student_id = data.student_id;
    this.products_id = data.products_id;
    this.variations_id = data.variations_id;
    this.quantity = data.quantity;
    this.mode_of_payment = data.mode_of_payment;
    this.status = data.status;
    this.user_remarks = data.user_remarks;
    this.admin_remarks = data.admin_remarks;
    this.status_updated = data.status_updated;
    this.edit_date = data.edit_date;
    this.date_stamp = data.date_stamp;
  }

  /**
   * Get order by ID
   * @param id Order ID
   * @param callback Callback function
   */
  public static fromId(id: string, callback: (error: ErrorTypes | null, order: Order | null) => void) {
    // Get database instance
    const db = Database.getInstance();

    // Query the database
    db.query('SELECT * FROM orders WHERE id = ?', [id], (error, results) => {
      // If has an error
      if (error) {
        Log.e(error.message);
        callback(ErrorTypes.DB_ERROR, null);
        return;
      }
      
      // If no results
      if (results.length === 0) {
        callback(ErrorTypes.DB_EMPTY_RESULT, null);
        return;
      }

      // Create and return the order
      callback(null, new Order(results[0]));
    });
  }

  /**
   * Find orders
   * @param param PaginationRequest
   */
  public static find(param: PaginationRequest, callback: (error: ErrorTypes | null, orders: FullOrderModel[] | null, count?: number) => void) {
    // Get database instance
    const db = Database.getInstance();
    // Data
    const data: PaginationQuery = {
      query: Order._fullOrderQuery
    };

    // If search column and value is present
    if (param.search_column && param.search_value) {
      const cols = JSON.parse(param.search_column);
      const vals = JSON.parse(param.search_value);

      for (const col of cols) {
        if (!Object.values(FullOrderEnum).includes(col as FullOrderEnum) && !col.startsWith("*")) {
          callback(ErrorTypes.REQUEST_KEY_NOT_ALLOWED, null);
          return;
        }
      }

      data.search = cols.map((column: string, index: number) => {
        return { column, value: vals[index] };
      });
    }

    // If order column and type is present
    if (param.sort_column && param.sort_type) {
      data.order = { column: param.sort_column, type: param.sort_type };
    }

    // If page and limit is present
    if (param.page && param.limit) {
      data.pagination = { page: parseInt(param.page), limit: parseInt(param.limit) };
    }
    
    // Get pagination
    const { query, values, countQuery, countValues } = paginationWrapper(data);

    // Query the database
    db.query(query, values, (error, results) => {
      // If has an error
      if (error) {
        Log.e(error.message);
        callback(ErrorTypes.DB_ERROR, null);
        return;
      }
      
      // If no results
      if (results.length === 0) {
        callback(ErrorTypes.DB_EMPTY_RESULT, null);
        return;
      }

      db.query(countQuery, countValues, (error, countResults) => {
        // If has an error
        if (error) {
          Log.e(error.message);
          callback(ErrorTypes.DB_ERROR, null);
          return;
        }

        // Create and return the orders with count
        callback(null, results.map((order: FullOrderModel) => order), countResults[0].count);
      });
    });
  }

  /**
   * Validate Order Data
   * @param data Raw order Data
   */
  public static validate(data: OrderRequest, isLoggedIn: boolean, files?: FileArray | null) {
    // If product ID is empty
    if (!data.products_id) return [Strings.ORDER_EMPTY_PRODUCT_ID, "products_id"];
    // If mode_of_payment is empty
    if (!data.mode_of_payment) return [Strings.ORDER_EMPTY_MODE_OF_PAYMENT, "mode_of_payment"];
    // If quantity is empty
    if (!data.quantity) return [Strings.ORDER_EMPTY_QUANTITY, "quantity"];

    // If mode of payment is GCash
    if (data.mode_of_payment == ModeOfPayment.GCASH) {
      // Check if photo/proof is present
      if (!getFile(files, "proof")) return [Strings.ORDER_EMPTY_PROOF, "proof"];
    }
    
    // If not logged in 
    if (!isLoggedIn) {
      // Check student id
      if (!data.student_id) return [Strings.ORDER_EMPTY_STUDENT_ID, "student_id"];
      // Check student first name
      if (!data.student_first_name) return [Strings.ORDER_EMPTY_STUDENT_FIRST_NAME, "student_first_name"];
      // Check student last name
      if (!data.student_last_name) return [Strings.ORDER_EMPTY_STUDENT_LAST_NAME, "student_last_name"];
      // Check student email
      if (!data.student_email) return [Strings.ORDER_EMPTY_STUDENT_EMAIL, "student_email"];
      // Check student course
      if (!data.student_course) return [Strings.ORDER_EMPTY_STUDENT_COURSE, "student_course"];
      // Check student year
      if (!data.student_year) return [Strings.ORDER_EMPTY_STUDENT_YEAR, "student_year"];
    }
  }

  /**
   * Insert order data to the database
   * @param studentID Student ID
   * @param order Order Data
   * @param callback Callback Function
   */
  public static insert(studentID: string | undefined, order: OrderRequest, files: FileArray | null, callback: (error: ErrorTypes | null, uniqueId: string | null) => void) {
    // Get database instance
    const datestamp = getDatestamp();
    const isLoggedIn = !!studentID;

    // If mode of payment is GCash
    if (order.mode_of_payment === ModeOfPayment.GCASH) {
      // Get screenshot/proof
      const proof = getFile(files, "proof");

      if (!proof) {
        Log.e(`Student #${studentID || order.student_id} is ordering with GCash without screenshot/proof.`);
        callback(ErrorTypes.REQUEST_FILE, null);
        return;
      }
    }

    // Find product
    Product.find({
      search_column: `["${ProductColumns.ID}"]`,
      search_value: `[${order.products_id}]`,
    }, (error, products, count) => {
      // If has an error
      if (error === ErrorTypes.DB_ERROR) {
        Log.e(`Order: Error finding product`);
        callback(ErrorTypes.DB_ERROR, null);
        return;
      }

      // If no results
      if (error === ErrorTypes.DB_EMPTY_RESULT) {
        Log.e(`Order: Product #${order.products_id} not found`);
        callback(ErrorTypes.DB_EMPTY_RESULT, null);
        return;
      }

      // Product 
      const product = products![0];

      // If has result
      if ((count || 0) > 0 && !product.is_available) {
        Log.e(`Student #${studentID || order.student_id} is ordering an unavailable product #${order.products_id}`);
        callback(ErrorTypes.UNAVAILABLE, null);
        return;
      }

      Order.getOrdersCountFromDate(new Date(), (count) => {
        // Generate reference number
        const generatedReference = generateReference(count + 1);
  
        Database.getConnection((error, conn) => {
          if (error) {
            Log.e(error.message);
            callback(ErrorTypes.DB_ERROR, null);
            return;
          }

          // Start transaction
          conn.beginTransaction(error => {
            if (error) {
              Log.e(error.message);
              callback(ErrorTypes.DB_ERROR, null);
              return;
            }
            
            // Generate unique ID
            const uniqueId = generateToken(20);

            // If logged in
            if (isLoggedIn) {
              // Query the Database
              conn.query("INSERT INTO orders VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [
                generatedReference,
                uniqueId,
                studentID,
                order.products_id,
                order.variations_id || null,
                order.quantity,
                order.mode_of_payment,
                OrderStatus.PENDING_PAYMENT,
                "", "", null, null, datestamp
              ], (error, results) => {
                if (error) {
                  Log.e(error.message);
                  callback(ErrorTypes.DB_ERROR, null);
                  return;
                }
                
                insertProof();
              });
    
              return;
            }
    
            // Otherwise, insert to non-bscs orders
            conn.query("INSERT INTO non_bscs_orders VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [
              generatedReference,
              uniqueId,
              order.products_id,
              order.variations_id || null,
              order.quantity,
              order.mode_of_payment,
              order.student_id,
              order.student_first_name,
              order.student_last_name,
              order.student_email,
              order.student_course,
              order.student_year,
              OrderStatus.PENDING_PAYMENT,
              "", "", null, null, datestamp
            ], (error, results) => {
              // If has an error
              if (error) {
                Log.e(error.message);
    
                // Rollback the transaction
                conn.rollback(() => {
                  callback(ErrorTypes.DB_ERROR, null);
                  return;
                });
    
                return;
              }
    
              insertProof();
            });
    
            function insertProof() {
              // If mode of payment is GCash
              if (order.mode_of_payment == ModeOfPayment.GCASH) {
                // Get screenshot/proof
                const photo = getFile(files, "proof");
    
                if (!photo) {
                  // Rollback the transaction
                  conn.rollback(error => {
                    if (error) Log.e(error.message);
                    callback(ErrorTypes.REQUEST_FILE, null);
                    return;
                  });
    
                  return;
                }
    
                // Insert the photo
                Photo.insert({ data: photo.data, type: photo.mimetype, name: photo.name, reference: generatedReference }, (error, photo) => {
                  if (error === ErrorTypes.DB_ERROR) {
                    Log.e(`Student #${studentID || order.student_id}: Error inserting screenshot/proof`);
    
                    // Rollback the transaction
                    conn.rollback(error => {
                      if (error) Log.e(error.message);
                      callback(ErrorTypes.DB_ERROR, null);
                      return;
                    });
    
                    return;
                  }
    
                  // Log order 
                  Log.i(`Student #${studentID || order.student_id} is ordering the product #${order.products_id} with reference #${generatedReference} by GCash`);
                  // Decrement stock
                  decrementStock();
                });
    
                return;
              }
    
              Log.i(`Student #${studentID || order.student_id} is ordering the product #${order.products_id} with reference #${generatedReference} by Walk-in`);
              // Decrement stock
              decrementStock();
            }
    
            function decrementStock() {
              // If has no sufficient stock
              if (product.stock < order.quantity) {
                Log.e(`Student #${studentID || order.student_id}: Product has insufficient stock`);
    
                // Rollback the transaction
                conn.rollback(error => {
                  if (error) Log.e(error.message);
                  callback(ErrorTypes.DB_PRODUCT_NO_STOCK, null);
                  return;
                });
    
                return;
              }
  
              Order.updateStock(-order.quantity, order.products_id, order.variations_id || null, error => {
                if (error === ErrorTypes.DB_ERROR) {
                  Log.e(`Student #${studentID || order.student_id}: Error decrementing stock`);
    
                  // Rollback the transaction
                  conn.rollback(error => {
                    if (error) Log.e(error.message);
                    callback(ErrorTypes.DB_ERROR, null);
                    return;
                  });
    
                  return;
                }
    
                // If no results
                if (error === ErrorTypes.DB_EMPTY_RESULT) {
                  Log.e(`Student #${studentID || order.student_id}: Error decrementing stock`);
    
                  // Rollback the transaction
                  conn.rollback(error => {
                    if (error) Log.e(error.message);
                    callback(ErrorTypes.DB_EMPTY_RESULT, null);
                    return;
                  });
    
                  return;
                }
    
                // Commit the transaction
                conn.commit((error) => {
                  if (error) {
                    Log.e(error.message);
    
                    // Rollback the transaction
                    conn.rollback(error => {
                      if (error) Log.e(error.message);
                      callback(ErrorTypes.DB_ERROR, null);
                      return;
                    });
    
                    return;
                  }
    
                  // Success commiting the transaction
                  callback(null, uniqueId);
                });
              });
            }
          });
        });
      });
    });
  }

  /**
   * Update order data
   * @param id Order ID
   * @param key Order Key
   * @param value Order Value
   */
  public static update(id: string, key: string, value: string, callback: (error: ErrorTypes | null, date_stamp?: string) => void) { 
    // If order ID is not present
    if (!id) {
      callback(ErrorTypes.REQUEST_ID);
      return;
    }

    // If key is not present
    if (!key) {
      callback(ErrorTypes.REQUEST_KEY);
      return;
    }

    // if key doesn't exists in order allowed keys
    if (!process.env.ORDERS_UPDATE_ALLOWED_KEYS?.includes(key)) {
      callback(ErrorTypes.REQUEST_KEY_NOT_ALLOWED);
      return;
    }

    // Get database instance
    const db = Database.getInstance();
    // Default data to set
    let data = `${sanitize(key)} = ?`
    
    // Split id (B and N)
    const [ TYPE, ID ] = id.split("-");
    
    // If updating status 
    if (key === OrderColumns.STATUS) {
      data = `${OrderColumns.STATUS} = ?, ${OrderColumns.STATUS_UPDATED} = NOW()`;

      // Find order
      Order.find({
        search_column: `["${OrderColumns.ID}"]`,
        search_value: `["${ID}"]`,
        limit: "1"
      }, (error, orders) => {
        // Get order
        const order = orders && orders?.length > 0 ? orders[0] : null;

        // If has an error
        if (error === ErrorTypes.DB_ERROR) {
          Log.e(`Student #${order?.student_id}: Error getting order while updating stock number`, true);
          update();
          return;
        }

        // If no results
        if (error === ErrorTypes.DB_EMPTY_RESULT) {
          Log.e(`Student #${order?.student_id}: Error getting order while updating stock number because order #${id} not found!`, true);
          update();
          return;
        }

        const isFromPendingOrComplete = order?.status == OrderStatus.PENDING_PAYMENT || order?.status == OrderStatus.COMPLETED;
        // If status is to cancelled, removed, rejected
        const toIncrement = [OrderStatus.CANCELLED_BY_ADMIN, OrderStatus.CANCELLED_BY_USER, OrderStatus.REJECTED, OrderStatus.REMOVED].includes(parseInt(value));

        // Log message
        Log.i("Order #" + id + " is " + mapOrderStatusLabel(parseInt(value)).toLowerCase());

        // INCREMENT
        if (isFromPendingOrComplete && toIncrement) {
          // Log message
          Log.i(`Incrementing stock by ${order.quantity} of order #` + id, true);
          // Increment stock
          Order.updateStock(order.quantity, order?.products_id || 0, order?.variations_id || null, error => {
            if (error === ErrorTypes.DB_ERROR) {
              Log.e(`Student #${order?.student_id}: Error incrementing stock`, true);
            }

            // If no results
            if (error === ErrorTypes.DB_EMPTY_RESULT) {
              Log.e(`Student #${order?.student_id}: Error incrementing stock`, true);
            }

            update();
          });

          return;
        }

        // DECREMENT
        if (!isFromPendingOrComplete && !toIncrement) {
          // Check if product has stock
          Product.fromId(order?.products_id || 0, (error, product) => {
            if (error === ErrorTypes.DB_ERROR) {
              Log.e(`Student #${order?.student_id}: Error getting product`, true);
              update();
              return;
            }

            // If no results
            if (error === ErrorTypes.DB_EMPTY_RESULT) {
              Log.e(`Student #${order?.student_id}: Product not found while decrementing stock`, true);
              update();
              return;
            }

            // If product has stock
            if (product && product.getStock() > order?.quantity!) {
              // Log message
              Log.i(`Decrementing stock by ${order?.quantity} of order #` + id, true);
              // Decrement stock
              Order.updateStock(-order?.quantity!, order?.products_id || 0, order?.variations_id || null, error => {
                if (error === ErrorTypes.DB_ERROR) {
                  Log.e(`Student #${order?.student_id}: Error decrementing stock`, true);
                }
    
                // If no results
                if (error === ErrorTypes.DB_EMPTY_RESULT) {
                  Log.e(`Student #${order?.student_id}: Error decrementing stock`, true);
                }
    
                update();
              });

              return;
            }

            // Log message
            Log.w(`Student #${order?.student_id}: Product has no sufficient stock while decrementing stock`, true);
            // Callback error
            callback(ErrorTypes.DB_PRODUCT_NO_STOCK);
          });

          return;
        }

        // Otherwise, just return success
        update();
      });

      return;
    }

    function update() {
      // Query the database
      db.query(`UPDATE ${TYPE === 'B' ? Tables.ORDERS : Tables.NON_BSCS_ORDERS } SET ${data}, ${OrderColumns.EDIT_DATE} = NOW() WHERE id = ?`, [value, ID], (error, results) => {
        // If has an error
        if (error) {
          Log.e(error.message);
          callback(ErrorTypes.DB_ERROR);
          return;
        }
  
        // If no results
        if (results.affectedRows === 0) {
          callback(ErrorTypes.DB_EMPTY_RESULT);
          return;
        }
  
        // Otherwise, return success
        callback(null, getDatestamp());
      });
    }

    // Otherwise, call update
    update();
  }

  /**
   * Get orders count from date
   * @param date Date to get orders count
   * @param callback Callback function
   */
  private static getOrdersCountFromDate(date: Date, callback: (count: number) => void) {
    // Get database instance
    const db = Database.getInstance();
    // Get local date YYYY-MM-DD
    const localDate = getLocalDate(date);

    // Query the database
    db.query("SELECT SUM(count) AS count FROM ((SELECT COUNT(*) AS count FROM orders WHERE DATE(date_stamp) = ?) UNION (SELECT COUNT(*) AS count FROM non_bscs_orders WHERE DATE(date_stamp) = ?)) t", [localDate, localDate], (error, results) => {
      // If has an error
      if (error) {
        Log.e(error.message);
        callback(0);
        return;
      }

      // If no results
      if (results.length === 0) {
        callback(0);
        return;
      }

      // Otherwise, return success
      callback(results[0].count);
    });
  }

  /**
   * Send email upon ordering
   */
  public static sendEmail(id: string, isStatusComplete?: boolean) {
    Order.find({
      search_column: `["${isStatusComplete ? OrderColumns.ID : OrderColumns.UNIQUE_ID}"]`,
      search_value: `["${id}"]`,
      limit: "1"
    }, (error, orders, count) => {
      if (error === ErrorTypes.DB_ERROR) {
        Log.e(`[ERROR] Can't send email: Database error`);
        return;
      }

      if (error === ErrorTypes.DB_EMPTY_RESULT) {
        Log.e(`[ERROR] Can't send email: Order with${isStatusComplete ? '' : ' unique'} ID #${id} not found`);
        return;
      }
      // Get order
      const order = orders ? orders[0] : null;

      // Send email if has an email address
      if (order?.email_address) {
        // If status is complete
        if (isStatusComplete) {
          // Log email sending
          Log.i("Sending order receipt to " + order?.email_address);
          // Send email
          sendEmail({
            subject: Strings.EMAIL_ORDER_COMPLETED_SUBJECT.replace("{reference}", order.reference),
            message: "",
            to: order?.email_address,
            receipt: {
              name: `${order.first_name} ${order.last_name}`,
              merch: order.product_name,
              variation: order.variations_name || "Standard",
              mode_of_payment: order.mode_of_payment === ModeOfPayment.WALK_IN ? "Cash" : "GCash",
              order_completed_date: getReadableDate(order.status_updated, true),
              order_placed_date: getReadableDate(order.date_stamp, true),
              price: order.product_price,
              quantity: order.quantity,
              reference: order.reference,
              total: order.product_price * order.quantity,
              qr_code_url: Strings.DOMAIN + "/api/qrcode/512/" + encodeURIComponent(Strings.DOMAIN + "/orders/" + order.unique_id),
              qr_code_redirect_url: Strings.DOMAIN + "/orders/" + order.unique_id,
            }
          }, (error, info) => {
            if (error) {
              Log.e(`[ERROR] Can't send email: ${error.message}`);
              return;
            }

            Log.i(`Order Receipt sent to ${order?.email_address}`);
          });

          return;
        }

        // Log email sending
        Log.i("Sending order email to " + order?.email_address);

        // Send email
        sendEmail({
          title: Strings.EMAIL_ORDER_TITLE,
          subject: Strings.EMAIL_ORDER_SUBJECT.replace("{reference}", order.reference),
          message: Strings.EMAIL_ORDER_BODY
            .replace("{name}", `${order.first_name} ${order.last_name}`)
            .replace("{date}", getReadableDate(order.date_stamp))
            .replace("{mode_of_payment}", order.mode_of_payment === ModeOfPayment.WALK_IN ? "Walk-in" : "GCash"),
          to: order?.email_address,
          order: {
            name: order.product_name,
            variation: order.variations_name || "Standard",
            quantity: order.quantity,
            price: order.product_price,
            mop: order.mode_of_payment === ModeOfPayment.WALK_IN ? 'Walk-in' : 'GCash',
            total: order.product_price * order.quantity,
            url: Strings.DOMAIN + "/merch/" + order.products_id,
            reference: order.reference,
            mode_of_payment: order.mode_of_payment === ModeOfPayment.WALK_IN ? "Cash" : "GCash",
            thumbnail_url: Strings.DOMAIN + "/api/photos/" + order.thumbnail + "/raw"
          }
        }, (error, info) => {
          if (error) {
            Log.e(`[ERROR] Can't send email: ${error.message}`);
            return;
          }

          Log.i(`Order Email sent to ${order?.email_address}`);
        });

        return;
      }

      Log.e(`[ERROR] Can't send email: Student #${order?.student_id} has no email address`);
    });
  }

  /**
   * Update stock number
   */
  private static updateStock(delta: number, products_id: number, variations_id: number | null, callback: (error: ErrorTypes | null) => void) {
    // Get database instance
    const db = Database.getInstance();

    // Query the database
    db.query(`UPDATE ${variations_id === null ? 'products' : 'product_variations'} SET stock = stock ${delta < 0 ? delta.toString() : '+ ' + delta} WHERE ${variations_id === null ? 'id' : 'products_id'} = ? ${variations_id === null ? '' : 'AND variations_id = ?'}`, [products_id, variations_id], (error, results) => {
      // If has an error
      if (error) {
        Log.e(error.message);
        callback(ErrorTypes.DB_ERROR);
        return;
      }

      // If no results
      if (results.affectedRows === 0) {
        callback(ErrorTypes.DB_EMPTY_RESULT);
        return;
      }

      // Otherwise, return success
      callback(null);
    });
  }

  /**
   * Get Order ID
   */
  public getId() {
    return this.id;
  }
}