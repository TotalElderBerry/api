import type { AppRoutes, ElysiaContext, ResponseBody } from "../types";
import { AuthType } from "../types/enums";

import {
  announcements, courses, env, events, example, forgot,
  login, orders, photos, products, reset, students, qrcode, colleges, tatakforms
} from "../api"

import { login as ictlogin } from "../api/ictcongress2024/login";
import { students as ictstudents } from "../api/ictcongress2024/students";
import { index as ictconfig } from "../api/ictcongress2024/";
import { ictpendingorders } from "../api/ictcongress2024/orders";
import { ictrfid } from "../api/ictcongress2024/rfid";
import { ictstatistics } from "../api/ictcongress2024/statistics";
import { ictexport } from "../api/ictcongress2024/export";

import { login as tatkformLogin } from "../api/tatakforms/login";
import { login as tatakformAdminLogin } from "../api/tatakforms/admin";
import { students as tatakformStudents } from "../api/tatakforms/students";
import { attendance as tatakformAttendance } from "../api/tatakforms/attendance";

const routes: AppRoutes[] = [
  { path: "/example", methods: ["GET", "POST", "DELETE", "PUT"], handler: example },
  
  { path:  "/ictcongress2024", handler: ictconfig, methods: ["GET"] },
  { path:  "/ictcongress2024/login", handler: ictlogin, methods: ["GET", "POST", "OPTIONS"], auth: { GET: AuthType.ICT_ADMIN }},
  { path:  "/ictcongress2024/statistics", handler: ictstatistics, methods: ["GET"], auth: { GET: AuthType.ICT_ADMIN }},
  { path:  "/ictcongress2024/export/xlsx", handler: ictexport, methods: ["GET", "OPTIONS"], auth: { GET: AuthType.ICT_ADMIN, OPTIONS: AuthType.ADMIN }},
  { path:  "/ictcongress2024/export/csv", handler: ictexport, methods: ["GET", "OPTIONS"], auth: { GET: AuthType.ICT_ADMIN, OPTIONS: AuthType.ADMIN }},
  { path:  "/ictcongress2024/rfid/:rfid", handler: ictrfid, methods: ["POST", "OPTIONS"], auth: { GET: AuthType.ICT_ADMIN }},
  { path:  "/ictcongress2024/students", handler: ictstudents, methods: ["GET", "POST", "OPTIONS"], auth: { GET: AuthType.ICT_ADMIN }},
  { path:  "/ictcongress2024/students/:uid", handler: ictstudents, methods: ["GET", "DELETE"], auth: { GET: AuthType.ICT_ADMIN, DELETE: AuthType.ICT_ADMIN }},
  { path:  "/ictcongress2024/students/:uid/:operation", handler: ictstudents, methods: ["POST", "OPTIONS"], auth: { POST: AuthType.ICT_ADMIN }},
  { path:  "/ictcongress2024/students/qr/:qr/:operation", handler: ictstudents, methods: ["POST", "OPTIONS"], auth: { POST: AuthType.ICT_ADMIN }},
  { path:  "/ictcongress2024/campus/pending-orders", handler: ictpendingorders, methods: ["GET", "DELETE", "OPTIONS"], auth: { GET: AuthType.ICT_ADMIN, DELETE: AuthType.ICT_ADMIN }},

  { path: "/tatakforms/login", methods: ["POST", "OPTIONS"], handler: tatkformLogin },
  { path: "/tatakforms/register", methods: ["POST", "OPTIONS"], handler: tatakformStudents },
  { path: "/tatakforms/admin/login", methods: ["POST", "OPTIONS"], handler: tatakformAdminLogin },
  { path: "/tatakforms/:slug", methods: ["GET"], handler: tatakforms },
  { path: "/tatakforms/attendance/" , methods: ['GET'], handler: tatakformAttendance, auth: {GET: AuthType.TATAKFORM_ACCOUNT} },
  { path: "/tatakforms/attendance/event/:eventId" , methods: ['GET'], handler: tatakformAttendance, auth: {GET: AuthType.TATAKFORM_ACCOUNT_ADMIN}},
  { path: "/tatakforms/attendance/:slug" , methods: ['POST','GET'], handler: tatakformAttendance, auth: {POST: AuthType.TATAKFORM_ACCOUNT_ADMIN} },
  { path: "/tatakforms/attendance/:slug/download" , methods: ['GET'], handler: tatakformAttendance, auth: {GET: AuthType.TATAKFORM_ACCOUNT} },
  { path: "/tatakforms/config", methods: ["GET"], handler: tatakforms },
  { path: "/tatakforms", methods: ["GET"], handler: tatakforms },

  { path: "/announcements/:id", methods: ["PUT", "DELETE", "OPTIONS"], handler: announcements, auth: { PUT: AuthType.ADMIN, DELETE: AuthType.ADMIN }},
  { path: "/announcements", methods: ["GET","POST"], handler: announcements, auth: { POST: AuthType.ADMIN }},

  { path: "/courses/:id", methods: ["PUT", "DELETE"], handler: courses, auth: { PUT: AuthType.ADMIN, DELETE: AuthType.ADMIN } },
  { path: "/courses", methods: ["GET", "POST"], handler: courses, auth: { POST: AuthType.ADMIN }},

  { path: "/colleges", methods: ["GET"], handler: colleges },
  { path: "/colleges/:acronym", methods: ["GET"], handler: colleges },

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