import type { ElysiaContext, ResponseBody } from "../types";
import response from "../utils/response";
import Tatakform from "../db/models/tatakform/tatakform";
import { status501 } from "../routes";
import College from "../db/models/college";

/**
 * Tatakforms API
 * @author mavyfaby (Maverick Fabroa)
 * @param context
 */
export function tatakforms(context: ElysiaContext): Promise<ResponseBody | undefined> | ResponseBody {
  switch (context.request.method) {
    case "GET":
      return getTatakforms(context);
  }

  return status501(context);
}

/**
 * GET /tatakforms (read)
 */
async function getTatakforms(context: ElysiaContext) {
  // Get slug param
  const slug = context.params?.slug;

  try {
    // If getting tatakform config
    if (context.path.endsWith("/config")) {
      // Get colleges
      const colleges = await College.getAll();

      // Return tatakform config
      return response.success("Fetched tatakform config.", {
        colleges
      });
    }

    // if slug is provided
    if (slug) {
      const tatakform = await Tatakform.getBySlug(slug);
      return response.success("Tatakform found!", tatakform);
    }

    // Otherwise, get all tatakforms
    const tatakforms = await Tatakform.getAll();
    return response.success("Tatakforms found!", tatakforms);
  } catch (err) {
    return response.error(err);
  }
}
