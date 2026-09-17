import { afterEach, describe, expect, it, vi } from "vitest";

import { bootstrapAdmin, type AdminBootstrapRepository } from "../src/lib/auth/bootstrap";

function repository(existingUsers = 0) {
  const created: Array<{ username: string; passwordHash: string }> = [];
  const value: AdminBootstrapRepository = {
    countUsers: async () => existingUsers,
    createUser: async (input) => {
      created.push(input);
      return { id: "admin-1", username: input.username };
    },
  };
  return { value, created };
}

describe("administrator bootstrap", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("creates the only administrator with a password hash", async () => {
    const repo = repository();

    const user = await bootstrapAdmin({ username: "admin", password: "a-strong-local-password" }, repo.value);

    expect(user).toEqual({ id: "admin-1", username: "admin" });
    expect(repo.created).toHaveLength(1);
    expect(repo.created[0].username).toBe("admin");
    expect(repo.created[0].passwordHash).not.toContain("a-strong-local-password");
  });

  it("rejects setup after an administrator already exists", async () => {
    const repo = repository(1);

    await expect(bootstrapAdmin({ username: "other", password: "another-strong-password" }, repo.value))
      .rejects.toThrow("管理员已初始化");
    expect(repo.created).toHaveLength(0);
  });

  it("rejects short passwords", async () => {
    const repo = repository();
    await expect(bootstrapAdmin({ username: "admin", password: "too-short" }, repo.value))
      .rejects.toThrow("至少 12 位");
  });

  it("allows the documented local admin credentials outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const repo = repository();

    await expect(bootstrapAdmin({ username: "admin", password: "admin" }, repo.value))
      .resolves.toEqual({ id: "admin-1", username: "admin" });
  });

  it("rejects the local admin credentials in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const repo = repository();

    await expect(bootstrapAdmin({ username: "admin", password: "admin" }, repo.value))
      .rejects.toThrow("至少 12 位");
  });
});
