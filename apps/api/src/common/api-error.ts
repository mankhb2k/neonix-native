import { HttpException } from "@nestjs/common";

// Keeps the exact same wire shape every route already used pre-Nest
// (`{ error: { message, code? } }`) so existing API consumers/tests don't
// see a breaking response-shape change just because the framework changed.
export class ApiError extends HttpException {
  constructor(status: number, message: string, code?: string) {
    super({ error: code ? { message, code } : { message } }, status);
  }
}
