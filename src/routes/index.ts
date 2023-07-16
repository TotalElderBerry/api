
import { example } from "../core/example";
import { login } from "../core/auth/login";
import { products } from "../core/products";
import { events } from "../core/events";
import { students } from "../core/students";
import { tutorials } from "../core/tutorials";

/**
 * This file contains all the routes of the api and the handlers that will be executed.
 * 
 * The structure is as follows:
 * - path: The path of the request
 * - methods: The methods that will be accepted by the path
 * - handler: The function that will be executed when the path is requested
 * 
 * NOTE: Order matters. The first route that matches the path will be executed.
 */
export const routes: AppRoutes[] = [
  // Example
  { path: "/example", methods: ["GET"], handler: example },

  // Login
  { path: "/login", methods: ["POST"], handler: login },

  // Products
  { path: "/products/:id", methods: ["GET"], handler: products },
  { path: "/products", methods: ["GET", "POST"], handler: products  },

  // Students
  { path: "/students/:id", methods: ["GET"], handler: students },
  { path: "/students", methods: ["GET", "POST"], handler: students },

  // Events
  { path: "/events/:id", methods: ["GET"], handler: events },
  { path: "/events", methods: ["GET"], handler: events },

  //Tutorials
  { path: "/tutorials/:year", methods: ["GET"], handler: tutorials },
  { path: "/tutorials", methods: ["GET", "POST"], handler: tutorials },

  // Photos
  { path: "/photos/:id/raw", methods: ["GET"], handler: photos },
  { path: "/photos/:id", methods: ["GET"], handler: photos },
  { path: "/photos", methods: ["POST"], handler: photos },
];