import { createHash } from "node:crypto";

export function hashBookingAccessToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
