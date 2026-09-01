// Create (or update the password of) an allowlisted login account.
// Usage: npx tsx scripts/create-user.ts user@example.com "S0meP@ssword"
import { db, users } from "../db";
import { hashPassword } from "../lib/auth";
import { eq } from "drizzle-orm";

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.error('Usage: npx tsx scripts/create-user.ts <email> <password>');
    process.exit(1);
  }
  const passwordHash = await hashPassword(password);
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length) {
    await db.update(users).set({ passwordHash }).where(eq(users.email, email));
    console.log(`Updated password for ${email}`);
  } else {
    await db.insert(users).values({ email, passwordHash });
    console.log(`Created user ${email}`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
