import "dotenv/config";
import { MongoClient, type Db } from "mongodb";

let client: MongoClient | undefined;
let connection: Promise<Db> | undefined;

export function getDb(): Promise<Db> {
  if (!connection) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("Missing MONGODB_URI. Configure MongoDB before starting the server.");
    client = new MongoClient(uri, { maxPoolSize: 10, serverSelectionTimeoutMS: 10000, ignoreUndefined: true });
    connection = client.connect().then(async () => {
      const db = client!.db(process.env.MONGODB_DB || "web_truyen");
      await Promise.all([
        db.collection("users").createIndex({ usernameKey: 1 }, { unique: true }),
        db.collection("chapters").createIndex({ comicSlug: 1, slug: 1 }, { unique: true }),
        db.collection("chapters").createIndex({ comicSlug: 1, number: 1 }),
        db.collection("comments").createIndex({ thread: 1, createdAt: -1 }),
        db.collection("provider_cache").createIndex({ provider: 1, key: 1 }, { unique: true }),
        db.collection("provider_cache").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
      ]);
      return db;
    }).catch(async (error) => {
      connection = undefined;
      await client?.close();
      throw error;
    });
  }
  return connection;
}

export async function closeDb() {
  await client?.close();
  connection = undefined;
}

export async function readState<T>(key: string, fallback: T): Promise<T> {
  const db = await getDb();
  const entry = await db.collection<{ _id: string; value: T }>("app_state").findOne({ _id: key });
  return entry?.value ?? fallback;
}

export async function writeState<T>(key: string, value: T) {
  const db = await getDb();
  await db.collection<{ _id: string; value: T }>("app_state").updateOne({ _id: key }, { $set: { value } }, { upsert: true });
}

export async function loadProviderCache(provider: string): Promise<Record<string, { data: any; timestamp: number }>> {
  const db = await getDb();
  const rows = await db.collection("provider_cache").find({ provider, expiresAt: { $gt: new Date() } }).toArray();
  return Object.fromEntries(rows.map((row) => [row.key, { data: row.data, timestamp: row.timestamp }]));
}

export async function saveProviderCache(provider: string, key: string, data: unknown, timestamp: number) {
  const db = await getDb();
  // Retain stale data for fallback, then expire it to keep storage bounded in time.
  const expiresAt = new Date(timestamp + 7 * 24 * 60 * 60 * 1000);
  await db.collection("provider_cache").updateOne({ provider, key }, { $set: { data, timestamp, expiresAt } }, { upsert: true });
}
