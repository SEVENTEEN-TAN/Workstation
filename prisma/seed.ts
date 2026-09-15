import { hashPassword } from "../src/lib/auth/password";
import { seedPublishedSiteVersion } from "../src/lib/content/seed";
import { getDatabase } from "../src/lib/db";

async function main() {
  const adminPassword = process.env.ADMIN_PASSWORD;
  const database = await getDatabase();
  const passwordHash = adminPassword ? await hashPassword(adminPassword) : null;
  const admin = adminPassword
    ? await database.user.upsert({
        where: { username: process.env.ADMIN_USERNAME ?? "admin" },
        update: { passwordHash: passwordHash!, isActive: true },
        create: {
          username: process.env.ADMIN_USERNAME ?? "admin",
          passwordHash: passwordHash!,
        },
      })
    : null;

  await seedPublishedSiteVersion(database, admin?.id ?? null);
}

main()
  .then(async () => (await getDatabase()).$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await (await getDatabase()).$disconnect();
    process.exit(1);
  });
