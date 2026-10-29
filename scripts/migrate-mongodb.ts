import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { closeDb, getDb, saveProviderCache, writeState } from "../server/database";
import { dataDir, writeComicDirect } from "../server/storage";
import type { Comic } from "../server/types";

const migrationDir = process.env.LEGACY_DATA_DIR ? path.resolve(process.env.LEGACY_DATA_DIR) : dataDir;

async function readJson<T>(filename: string): Promise<T | undefined> {
  try { return JSON.parse(await readFile(path.join(migrationDir, filename), "utf8")) as T; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

try {
  const db = await getDb();
  // Run with the app and crawler stopped. Existing DB records win; files stay untouched.
  let count = 0;
  const comics = await readJson<Comic[]>("comics.json") || [];
  let filenames: string[] = [];
  try { filenames = await readdir(path.join(migrationDir, "comics")); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  const bySlug = new Map(comics.map((comic) => [comic.slug, comic]));
  for (const filename of filenames.filter((name) => name.endsWith(".json"))) {
    const comic = await readJson<Comic>(path.join("comics", filename));
    if (comic) bySlug.set(comic.slug, comic);
  }
  for (const comic of bySlug.values()) {
    if (["sky-market", "neon-district"].includes(comic.slug) && comic.author === "TPM Studio" && comic.source?.license === "Demo") continue;
    if (await db.collection("comics").findOne({ slug: comic.slug })) continue;
    await writeComicDirect(comic);
    count++;
  }
  console.log(`Imported comics: ${count}`);
  const users = await readJson<Array<Record<string, any>>>("users.json") || [];
  for (const original of users) {
    const { passwordPlain, _id, ...user } = original;
    if (!user.id || !user.username || !user.passwordHash) throw new Error("Invalid user in legacy data.");
    await db.collection<{ _id: string; [key: string]: any }>("users").updateOne(
      { _id: user.id }, { $setOnInsert: { ...user, usernameKey: user.username.toLowerCase(), revision: 0 } }, { upsert: true }
    );
  }
  const comments = await readJson<Record<string, Array<Record<string, any>>>>("chapter_comments.json") || {};
  for (const [thread, entries] of Object.entries(comments)) {
    for (const comment of entries) {
      await db.collection<{ _id: string; [key: string]: any }>("comments").updateOne(
        { _id: `${thread}:${comment.id}` }, { $setOnInsert: { ...comment, thread } }, { upsert: true }
      );
    }
  }
  for (const [filename, provider] of [
    ["otruyen_detail_cache.json", "otruyen_detail"], ["otruyen_chapter_cache.json", "otruyen_chapter"],
    ["vsmov_detail_cache.json", "movie_detail"], ["vsmov_list_cache.json", "movie_list"]
  ]) {
    const cache = await readJson<Record<string, { data: unknown; timestamp: number }>>(filename) || {};
    for (const [key, entry] of Object.entries(cache)) {
      if (entry.timestamp < Date.now() - 7 * 86400000) continue;
      if (await db.collection("provider_cache").findOne({ provider, key })) continue;
      await saveProviderCache(provider, key, entry.data, entry.timestamp);
    }
  }
  for (const [filename, key] of [["access_logs.json", "access_logs"], ["truyenqq_compare_sync.json", "truyenqq_compare_sync"]]) {
    const value = await readJson<unknown>(filename);
    if (value !== undefined && !await db.collection("app_state").findOne({ _id: key } as any)) await writeState(key, value);
  }
  console.log("Migration complete. Legacy JSON files were not deleted.");
} catch (error) {
  console.error("Migration failed:", error instanceof Error ? error.message : "Unknown error");
  process.exitCode = 1;
} finally {
  await closeDb();
}
