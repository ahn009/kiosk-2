// One-off bootstrap: create (or update) the first superadmin from env.
// Usage:
//   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='<strong-password>' \
//     [ADMIN_NAME='Your Name'] bun prisma/bootstrap-admin.ts
//
// Refuses weak passwords. Never commit credentials — pass them via env.
import { db } from "../src/lib/db";
import { hashSecret } from "../src/lib/crypto";

async function main() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD ?? "";
  const name = process.env.ADMIN_NAME?.trim() || null;

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    console.error("ADMIN_EMAIL must be set to a valid email address.");
    process.exit(1);
  }
  if (password.length < 12) {
    console.error("ADMIN_PASSWORD must be at least 12 characters.");
    process.exit(1);
  }

  await db.adminUser.upsert({
    where: { email },
    update: {
      passwordHash: hashSecret(password),
      role: "superadmin",
      name,
    },
    create: {
      email,
      passwordHash: hashSecret(password),
      role: "superadmin",
      name,
    },
  });

  console.log(`Superadmin ready: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
