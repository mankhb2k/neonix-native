import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { fromNodeHeaders } from "better-auth/node";
import type { Request } from "express";
import { ApiError } from "../common/api-error";
import { auth } from "./auth";

declare module "express" {
  interface Request {
    userId: string;
  }
}

@Injectable()
export class CurrentUserGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
    if (!session) throw new ApiError(401, "Not authenticated");
    request.userId = session.user.id;
    return true;
  }
}
