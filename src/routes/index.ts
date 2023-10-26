import type { AppRoutes, ElysiaContext, ResponseBody } from "../types";
import { AuthType } from "../types/enums";

import example from "../api/example";
import env from "../api/env";

const routes: AppRoutes[] = [
  // Example
  { path: "/example", methods: ["GET", "POST", "DELETE", "PUT"], handler: example },

  // Env
  { path: "/env/:key", methods: ["GET", "PUT", "DELETE"], handler: env, auth: { "PUT": AuthType.ADMIN, "DELETE": AuthType.ADMIN }},
  { path: "/env", methods: ["GET", "POST"], handler: env, auth: { "POST": AuthType.ADMIN }},
];

export function status404(context: ElysiaContext): ResponseBody {
  context.set.status = 404;
  return { success: false, message: "The requested resource could not be found." };
}

export function status501(context: ElysiaContext): ResponseBody {
  context.set.status = 501;
  return { success: false, message: "The requested resource is not implemented." };
}

export default routes;