import { closeDb, getDb } from "../server/database";

try {
  const username = process.argv[2]?.trim().toLowerCase();
  if (!username) throw new Error("Usage: npm run db:admin -- <registered-username>");
  const db = await getDb();
  const result = await db.collection("users").updateOne({ usernameKey: username }, { $set: { role: "admin" }, $inc: { revision: 1 } });
  if (!result.matchedCount) throw new Error("Register this account first.");
  console.log("Admin role assigned. Sign in again to refresh your account.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Could not assign admin role.");
  process.exitCode = 1;
} finally {
  await closeDb();
}
