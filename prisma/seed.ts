import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

import { Prisma } from "@prisma/client";

import { hashPassword } from "../src/lib/auth/password";
import { migrateLegacySiteContent } from "../src/lib/content/legacy";
import { siteContentSchema } from "../src/lib/content/schema";
import { getDatabase } from "../src/lib/db";

async function loadLegacyData() {
  const homepageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../HomePage");
  const contentUrl = pathToFileURL(resolve(homepageRoot, "src/data/content.js"));
  const projectsUrl = pathToFileURL(resolve(homepageRoot, "src/data/projects.js"));
  const [{ content }, { projects }] = await Promise.all([
    import(contentUrl.href),
    import(projectsUrl.href),
  ]);

  return siteContentSchema.parse(migrateLegacySiteContent(content, projects));
}

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

  const existingVersion = await database.siteVersion.findFirst();
  if (!existingVersion) {
    const content = await loadLegacyData();
    await database.siteVersion.create({
      data: {
        version: 1,
        status: "PUBLISHED",
        content: content as Prisma.InputJsonValue,
        createdById: admin?.id ?? null,
        publishedAt: new Date(),
      },
    });
  }
}

main()
  .then(async () => (await getDatabase()).$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await (await getDatabase()).$disconnect();
    process.exit(1);
  });
