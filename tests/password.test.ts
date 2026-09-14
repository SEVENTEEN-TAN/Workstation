import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "../src/lib/auth/password";

describe("password hashing", () => {
  it("uses an Argon2id hash that verifies only the original password", async () => {
    const hash = await hashPassword("correct horse battery staple");

    expect(hash).toMatch(/^\$argon2id\$/);
    await expect(verifyPassword(hash, "correct horse battery staple")).resolves.toBe(true);
    await expect(verifyPassword(hash, "incorrect")).resolves.toBe(false);
  });
});
