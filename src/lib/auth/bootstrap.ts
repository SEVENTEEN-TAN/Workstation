import { getDatabase } from "../db";
import { hashPassword } from "./password";

export type AdminBootstrapRepository = {
  countUsers(): Promise<number>;
  createUser(input: { username: string; passwordHash: string }): Promise<{ id: string; username: string }>;
};

export async function bootstrapAdmin(
  input: { username: string; password: string },
  repository?: AdminBootstrapRepository,
): Promise<{ id: string; username: string }> {
  const username = input.username.trim();
  if (username.length < 3) throw new Error("用户名至少 3 位");
  if (input.password.length < 12) throw new Error("密码至少 12 位");

  if (!repository) {
    const database = await getDatabase();
    return database.$transaction((transaction) => bootstrapAdmin(input, {
      countUsers: () => transaction.user.count(),
      createUser: (data) => transaction.user.create({ data, select: { id: true, username: true } }),
    }));
  }

  if (await repository.countUsers()) throw new Error("管理员已初始化");
  return repository.createUser({ username, passwordHash: await hashPassword(input.password) });
}

export async function hasAdministrator() {
  return (await (await getDatabase()).user.count()) > 0;
}
