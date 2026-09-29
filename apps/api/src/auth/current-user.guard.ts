import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { ApiError } from "../common/api-error";

declare module "express" {
  interface Request {
    userId: string;
  }
}

// TODO(auth): replace with a real Better Auth session guard once OAuth
// cutover happens (see project memory: routes are being built and tested
// against a seed account first, auth wiring comes after). Every request is
// currently treated as already authenticated as SEED_USER_ID.
@Injectable()
export class CurrentUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const userId = process.env.SEED_USER_ID?.trim();
    if (!userId) throw new ApiError(500, "SEED_USER_ID is not configured");
    const request = context.switchToHttp().getRequest<Request>();
    request.userId = userId;
    return true;
  }
}
