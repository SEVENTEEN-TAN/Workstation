import { createHash, timingSafeEqual } from "node:crypto";

const hashPattern = /^[a-f0-9]{64}$/;
const bearerPattern = /^Bearer ([A-Za-z0-9_-]+)$/;

export function verifyKnowledgeSyncToken(authorization: string | null, configuredHash: string | undefined) {
  const match = authorization?.match(bearerPattern);
  if (!match || !configuredHash || !hashPattern.test(configuredHash)) return false;
  const expected = Buffer.from(configuredHash, "hex");
  const received = createHash("sha256").update(match[1]).digest();
  return expected.length === received.length && timingSafeEqual(expected, received);
}
