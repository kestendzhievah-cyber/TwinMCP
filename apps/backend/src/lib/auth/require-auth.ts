import { requireSessionUser, type SessionUser } from "@/lib/session";
import { unauthorized, forbidden, notFound, serverError } from "@/lib/errors";
import { ForbiddenError, NotFoundError } from "./rbac";

type Handler = (req: Request, user: SessionUser) => Promise<Response> | Response;

export function withAuth(handler: Handler) {
  return async (req: Request): Promise<Response> => {
    const user = await requireSessionUser(req);
    if (!user) return unauthorized("Authentication required");
    try {
      return await handler(req, user);
    } catch (err) {
      if (err instanceof ForbiddenError) return forbidden(err.message);
      if (err instanceof NotFoundError) return notFound(err.message);
      console.error("[withAuth] handler error:", err);
      return serverError();
    }
  };
}
