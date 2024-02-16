import type { AppRoutes, ElysiaContext, ResponseBody } from "../types";
import { AuthType } from "../types/enums";

import {
  announcements, courses, env, events, example, forgot,
  login, orders, photos, products, reset, students, qrcode
} from "../api"

import { login as ictlogin } from "../api/ictcongress2024/login";
import { students as ictstudents } from "../api/ictcongress2024/students";
import { index as ictconfig } from "../api/ictcongress2024/";
import { ictprice } from "../api/ictcongress2024/price";
import { ictpendingorders } from "../api/ictcongress2024/orders";
import { ictrfid } from "../api/ictcongress2024/rfid";

const routes: AppRoutes[] = [
  { path: "/example", methods: ["GET", "POST", "DELETE", "PUT"], handler: example },
  
  { path:  "/ictcongress2024", handler: ictconfig, methods: ["GET"] },
  { path:  "/ictcongress2024/login", handler: ictlogin, methods: ["GET", "POST", "OPTIONS"], auth: { GET: AuthType.ICT_ADMIN }},
  { path:  "/ictcongress2024/rfid/:rfid", handler: ictrfid, methods: ["POST", "OPTIONS"], auth: { GET: AuthType.ICT_ADMIN }},
  { path:  "/ictcongress2024/price/:discount_code", handler: ictprice, methods: ["GET"], auth: { GET: AuthType.ICT_ADMIN }},
  { path:  "/ictcongress2024/students", handler: ictstudents, methods: ["GET", "POST", "OPTIONS"], auth: { GET: AuthType.ICT_ADMIN, POST: AuthType.ICT_ADMIN }},
  { path:  "/ictcongress2024/students/:student_id", handler: ictstudents, methods: ["GET"], auth: { GET: AuthType.ICT_ADMIN }},
  { path:  "/ictcongress2024/students/:student_id/:operation", handler: ictstudents, methods: ["POST", "OPTIONS"], auth: { POST: AuthType.ICT_ADMIN }},
  { path:  "/ictcongress2024/campus/pending-orders", handler: ictpendingorders, methods: ["GET", "DELETE", "OPTIONS"], auth: { POST: AuthType.ICT_ADMIN }},

  { path: "/announcements/:id", methods: ["PUT", "DELETE", "OPTIONS"], handler: announcements, auth: { PUT: AuthType.ADMIN, DELETE: AuthType.ADMIN }},
  { path: "/announcements", methods: ["GET","POST"], handler: announcements, auth: { POST: AuthType.ADMIN }},

  { path: "/courses/:id", methods: ["PUT", "DELETE"], handler: courses, auth: { PUT: AuthType.ADMIN, DELETE: AuthType.ADMIN } },
  { path: "/courses", methods: ["GET", "POST"], handler: courses, auth: { POST: AuthType.ADMIN }},

  { path: "/env/:key", methods: ["GET", "PUT", "DELETE"], handler: env, auth: { PUT: AuthType.ADMIN, DELETE: AuthType.ADMIN }},
  { path: "/env", methods: ["GET", "POST"], handler: env, auth: { POST: AuthType.ADMIN }},

  { path: "/events/next", methods: ["GET"], handler: events },
  { path: "/events/:id", methods: ["PUT", "DELETE", "OPTIONS"], handler: events, auth: { PUT: AuthType.ADMIN, DELETE: AuthType.ADMIN }},
  { path: "/events", methods: ["GET", "POST"], handler: events, auth: { POST: AuthType.ADMIN }},

  { path: "/forgot", methods: ["POST"], handler: forgot },

  { path: "/login", methods: ["GET", "POST", "OPTIONS"], handler: login },

  { path: "/orders/:id/:key", methods: ["PUT", "OPTIONS"], handler: orders, auth: { PUT: AuthType.ADMIN }},
  { path: "/orders/reference/:reference", methods: ["GET"], handler: orders, auth: { "GET": AuthType.ADMIN }},
  { path: "/orders/unique/:uniqueId", methods: ["GET"], handler: orders },
  { path: "/orders/guest", methods: ["GET"], handler: orders },
  { path: "/orders", methods: ["GET", "POST"], handler: orders, auth: { GET: [ AuthType.ADMIN, AuthType.STUDENT ] }},
  
  { path: "/photos/:hash", methods: ["GET"], handler: photos },
  { path: "/photos", methods: ["POST"], handler: photos },

  { path: "/products/:slug/:key", methods: ["PUT", "OPTIONS"], handler: products, auth: { PUT: AuthType.ADMIN }},
  { path: "/products/:slug", methods: ["GET", "PUT", "OPTIONS"], handler: products, auth: { PUT: AuthType.ADMIN }},
  { path: "/products", methods: ["GET", "POST"], handler: products, auth: { POST: AuthType.ADMIN }},

  { path: "/qrcode" , methods: ['GET'], handler: qrcode },
  
  { path: "/students/password", methods: ["PUT", "OPTIONS"], handler: students, auth: { PUT: AuthType.STUDENT }},
  { path: "/students/:student_id", methods: ["PUT", "OPTIONS"], handler: students, auth: { POST: AuthType.ADMIN }},
  { path: "/students", methods: ["GET", "POST"], handler: students, auth: { POST: AuthType.ADMIN }},

  { path: "/reset/:token", methods: ["GET"], handler: reset },
  { path: "/reset/", methods: ["POST"], handler: reset },
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