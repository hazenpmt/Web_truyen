import assert from "node:assert/strict";
import { test } from "node:test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:net";
import { MongoMemoryServer } from "mongodb-memory-server";

test("MongoDB persistence, account isolation, API comments, and repeatable migration", { timeout: 180000 }, async () => {
  const mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri();
  process.env.MONGODB_DB = "integration_test";
  process.env.JWT_SECRET = "integration-test-only-secret";
  const database = await import("../server/database");
  const storage = await import("../server/storage");
  const auth = await import("../server/auth");
  let api: ReturnType<typeof spawn> | undefined;
  const legacyDir = await mkdtemp(path.join(tmpdir(), "web-truyen-migration-"));
  try {
    assert.deepEqual(await storage.readComicIndex(), []);
    const comic = {
      id: "test-comic", slug: "test-comic", title: "Test comic", author: "Test", description: "Test",
      status: "ongoing" as const, genres: [], cover: "https://example.test/cover.jpg", rating: 0, views: 0,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      chapters: [2, 1].map((number) => ({ id: `c${number}`, slug: `c${number}`, number, title: `Chapter ${number}`,
        createdAt: new Date().toISOString(), pages: [{ index: 1, image: `https://example.test/${number}.jpg` }] }))
    };
    await storage.writeComicDirect(comic);
    await storage.writeComicDirect(comic);
    const db = await database.getDb();
    assert.equal(await db.collection("chapters").countDocuments(), 2);
    assert.equal((await storage.readComicIndex())[0].totalChapters, 2);
    assert.deepEqual((await storage.readComicBySlug(comic.slug))?.chapters.map((c) => c.number), [1, 2]);
    assert.equal((await db.collection("comics").findOne({ slug: comic.slug }))?.chapters, undefined);

    const account = await auth.registerUser({ username: "reader_one", password: "test-password" });
    const adminName = await auth.registerUser({ username: "admin", password: "test-password" });
    assert.equal(adminName.user.role, "user");
    assert.equal("passwordPlain" in account.user, false);
    assert.equal("passwordHash" in account.user, false);
    const login = await auth.loginUser({ username: "READER_ONE", password: "test-password" });
    assert.equal(login.user.id, account.user.id);
    await auth.updateUserHistory(account.user.id, { slug: "movie", title: "Movie", poster: "", episodeSlug: "ep1", episodeName: "1" });
    await auth.updateUserComicHistory(account.user.id, { slug: comic.slug, source: "local", title: comic.title, cover: "", chapterSlug: "c1", chapterTitle: "1" });
    const first = await auth.readUsers();
    const second = await auth.readUsers();
    first.find((u) => u.id === account.user.id)!.displayName = "Updated reader";
    second.find((u) => u.id === adminName.user.id)!.displayName = "Other reader";
    await auth.writeUsers(first);
    await auth.writeUsers(second);
    assert.equal((await auth.verifyToken(login.token))?.displayName, "Updated reader");
    const stale = await auth.readUsers();
    await auth.updateUserProfile(account.user.id, { displayName: "Newer reader" });
    stale.find((u) => u.id === account.user.id)!.displayName = "Stale update";
    await assert.rejects(() => auth.writeUsers(stale), /another request/);
    await assert.rejects(() => auth.registerUser({ username: "reader_one", password: "different" }));

    await database.saveProviderCache("movie_detail", "movie", { title: "Movie", streamUrl: "https://example.test/video.m3u8" }, Date.now());
    await database.saveProviderCache("movie_detail", "expired", {}, Date.now() - 8 * 86400000);
    await database.closeDb();
    assert.equal((await database.loadProviderCache("movie_detail")).movie.data.title, "Movie");
    assert.equal((await database.loadProviderCache("movie_detail")).expired, undefined);
    const saved = await auth.verifyToken(login.token);
    assert.equal(saved?.watchHistory?.[0].episodeSlug, "ep1");
    assert.equal(saved?.comicHistory?.[0].chapterSlug, "c1");

    const portProbe = createServer();
    portProbe.listen(0, "127.0.0.1");
    await once(portProbe, "listening");
    const port = (portProbe.address() as { port: number }).port;
    await new Promise<void>((resolve) => portProbe.close(() => resolve()));
    api = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
      env: { ...process.env, PORT: String(port), ENABLE_BACKGROUND_SYNC: "0" }, stdio: ["ignore", "pipe", "pipe"]
    });
    let output = "";
    api.stdout?.on("data", (chunk) => { output += chunk; });
    api.stderr?.on("data", (chunk) => { output += chunk; });
    for (let attempt = 0; !output.includes("API running") && attempt < 100; attempt++) {
      if (api.exitCode !== null) throw new Error(output);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.match(output, /API running/);
    const endpoint = `http://127.0.0.1:${port}/api/comments/chapters`;
    const payload = { source: "local", comicSlug: comic.slug, chapterSlug: "c1", name: "Reader", text: "Test comment" };
    const responses = await Promise.all([1, 2].map(() => fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })));
    assert.deepEqual(responses.map((r) => r.status), [201, 201]);
    const comments = await (await fetch(`${endpoint}?source=local&comicSlug=test-comic&chapterSlug=c1`)).json();
    assert.equal(comments.comments.length, 2);

    await writeFile(path.join(legacyDir, "comics.json"), JSON.stringify([{ ...comic, id: "legacy", slug: "legacy" }]));
    await writeFile(path.join(legacyDir, "users.json"), JSON.stringify([{ id: "legacy-user", username: "legacy_reader", passwordHash: "already-hashed", passwordPlain: "must-not-import", createdAt: new Date().toISOString() }]));
    const migrate = async () => {
      const child = spawn(process.execPath, ["--import", "tsx", "scripts/migrate-mongodb.ts"], { env: { ...process.env, LEGACY_DATA_DIR: legacyDir }, stdio: ["ignore", "pipe", "pipe"] });
      let log = "";
      child.stdout?.on("data", (chunk) => { log += chunk; });
      child.stderr?.on("data", (chunk) => { log += chunk; });
      const [code] = await once(child, "exit");
      assert.equal(code, 0, log);
    };
    await migrate();
    await migrate();
    const imported = await (await database.getDb()).collection("users").findOne({ id: "legacy-user" });
    assert.equal(imported?.passwordPlain, undefined);
    assert.equal(await (await database.getDb()).collection("comics").countDocuments({ slug: "legacy" }), 1);
    assert.equal(await storage.deleteComicBySlug(comic.slug), true);
    assert.equal(await storage.readComicBySlug(comic.slug), undefined);
    assert.equal(await (await database.getDb()).collection("chapters").countDocuments({ comicSlug: comic.slug }), 0);
  } finally {
    if (api && api.exitCode === null) { api.kill(); await once(api, "exit"); }
    await database.closeDb();
    await mongo.stop();
    await rm(legacyDir, { recursive: true, force: true });
  }
});
