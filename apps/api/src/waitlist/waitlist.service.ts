import { Inject, Injectable } from "@nestjs/common";
import { ApiError } from "../common/api-error";
import { isUniqueViolation } from "../common/pg-errors";
import type { Database } from "../db/client";
import { DATABASE } from "../db/database.module";
import { waitlistSignups } from "../db/schema/misc";

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

function normalizeEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (email.length < 3 || email.length > 320 || !EMAIL_PATTERN.test(email)) {
    throw new ApiError(400, "Please provide a valid email address.");
  }
  return email;
}

@Injectable()
export class WaitlistService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** Returns `alreadySignedUp: true` instead of throwing on a duplicate email - matches the friendly (not error) UX the old Supabase route had. */
  async join(rawEmail: string): Promise<{ alreadySignedUp: boolean }> {
    const email = normalizeEmail(rawEmail);
    try {
      await this.db.insert(waitlistSignups).values({ email });
      return { alreadySignedUp: false };
    } catch (error) {
      if (isUniqueViolation(error)) return { alreadySignedUp: true };
      throw error;
    }
  }
}
