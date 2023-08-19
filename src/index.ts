import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import cors from "cors";

import { getPattern } from "./utils/route";
import { routes } from "./routes";
import { Log } from "./utils/log";
import { checkCredentials } from "./utils/validate";
import { handleNotFound, handleUnimplemented } from "./routes/handler";
import Database from "./db/database";

// Load environment variables from .env file
dotenv.config();

// Create an express app
const app = express();
// Set the port
const port = process.env.PORT || 4000;

// Configure cors
app.use(cors({ origin: "*" }));
// Use helmet for security
app.use(helmet({
  crossOriginResourcePolicy: {
    policy: "cross-origin" // TODO: Change this to "same-origin" in production
  }
}));
// Use text/plain request body
app.use(express.urlencoded({ extended: true }));
// Use custom logger
app.use(Log.getMiddleware());

/**
 * Handle requests specified in routes
 */
app.use(routes.map(r => r.path), (request, response) => {
  // Set default response content type
  response.setHeader("Content-Type", "application/json");
  // Get route pattern
  const pattern = getPattern(request.originalUrl);

  // If no pattern is found, return 404
  if (pattern === null) {
    return handleNotFound(request, response);
  }

  // Otherwise, call the route handler
  for (const route of routes) {
    // If the route matches the path
    if (pattern === route.path) {
      // If the method is not allowed, return 405
      if (!route.methods.includes(request.method as HttpMethod)) {
        return handleUnimplemented(request, response);
      }

      // Otherwise, call the API handler
      return route.handler(request, response); 
    }
  }
});

/**
 * Handle requests that are not specified in the routes
 */
app.use("*", (request, response) => {
  // If requesting for favicon, return image
  if (request.originalUrl === "/favicon.ico") {
    return response.sendFile("favicon.ico", { root: "./assets" });
  }

  // Otherwise, return 404
  return handleNotFound(request, response);
});

/**
 * Start the server
 */
app.listen(port, () => {
  // Check env credentials
  checkCredentials();
  // Initialize database
  Database.getInstance();
  // Log message
  Log.s(`UC Main CSPS backend API is listening on port ${port}`);
});