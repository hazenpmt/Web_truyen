import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getDb } from "./database";



const JWT_SECRET: string = (() => {
  if (!process.env.JWT_SECRET) throw new Error("Missing JWT_SECRET. Set a private signing key before starting the server.");
  return process.env.JWT_SECRET;
})();
const TOKEN_TTL = "30d";
const ADMIN_ONLY_AVATAR_FRAMES = new Set(["admin-gold"]);

export type FavoriteMovie = {
  slug: string;
  title: string;
  poster: string;
};

export type WatchHistoryItem = {
  slug: string;
  title: string;
  poster: string;
  episodeSlug: string;
  episodeName: string;
  watchedAt: string;
};

export type ComicFollowItem = {
  slug: string;
  source: string;
  title: string;
  cover: string;
  followedAt: string;
};

export type ComicHistoryServerItem = {
  slug: string;
  source: string;
  title: string;
  cover: string;
  chapterSlug: string;
  chapterTitle: string;
  updatedAt: string;
};

export type User = {
  id: string;
  username: string;
  passwordHash: string;
  passwordPlain?: string;
  avatar?: string;
  avatarFrame?: string;
  displayName?: string;
  createdAt: string;
  favorites?: FavoriteMovie[];
  favoriteActors?: string[];
  watchHistory?: WatchHistoryItem[];
  comicFollows?: ComicFollowItem[];
  comicHistory?: ComicHistoryServerItem[];
  role?: "admin" | "user";
};

export type PublicUser = Omit<User, "passwordHash" | "passwordPlain">;

// ── Storage helpers ──────────────────────────────────────────────
type UserRecord = User & { _id: string; usernameKey: string; revision: number };
const snapshots = new WeakMap<User[], Map<string, string>>();
const revisions = new WeakMap<User, number>();
function decodeUser(row: UserRecord): User {
  const { _id, usernameKey, revision, passwordPlain, ...user } = row;
  revisions.set(user, revision);
  return user;
}
export async function readUsers(): Promise<User[]> {
  const db = await getDb();
  const users = (await db.collection<UserRecord>("users").find().toArray()).map(decodeUser);
  snapshots.set(users, new Map(users.map((user) => [user.id, JSON.stringify(user)])));
  return users;
}
async function readUser(id: string): Promise<User | undefined> {
  const db = await getDb();
  const row = await db.collection<UserRecord>("users").findOne({ _id: id });
  return row ? decodeUser(row) : undefined;
}
async function saveUser(user: User): Promise<void> {
  const db = await getDb();
  const { passwordPlain, ...safe } = user;
  const revision = revisions.get(user);
  const record = { ...safe, _id: user.id, usernameKey: user.username.toLowerCase(), revision: (revision ?? -1) + 1 };
  if (revision === undefined) {
    try { await db.collection<UserRecord>("users").insertOne(record); }
    catch (error) {
      if ((error as { code?: number }).code === 11000) throw new AuthError("Username already exists.");
      throw error;
    }
  } else {
    const result = await db.collection<UserRecord>("users").replaceOne({ _id: user.id, revision }, record);
    if (!result.matchedCount) throw new AuthError("Account changed in another request. Please retry.");
  }
  revisions.set(user, record.revision);
}
export async function writeUsers(users: User[]): Promise<void> {
  const before = snapshots.get(users);
  if (!before) throw new Error("writeUsers requires the snapshot returned by readUsers.");
  for (const user of users) {
    if (before.get(user.id) !== JSON.stringify(user)) await saveUser(user);
  }
  const db = await getDb();
  const remaining = new Set(users.map((user) => user.id));
  for (const [id, json] of before) {
    if (!remaining.has(id)) {
      const original = JSON.parse(json) as User;
      const result = await db.collection<UserRecord>("users").deleteOne({ _id: id, usernameKey: original.username.toLowerCase() });
      if (!result.deletedCount) throw new AuthError("Account no longer exists.");
    }
  }
}

export function toPublic(user: User): PublicUser {
  const { passwordHash: _p, passwordPlain: _plain, ...pub } = user;
  return pub;
}

function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ── Auth actions ─────────────────────────────────────────────────
export async function registerUser(payload: {
  username: string;
  password: string;
}): Promise<{ user: PublicUser; token: string }> {
  const { username, password } = payload;

  if (!username || (username.trim().length < 6 && username.trim().toLowerCase() !== "admin"))
    throw new AuthError("Tên tài khoản phải có ít nhất 6 ký tự.");
  if (!/^[a-zA-Z0-9_]+$/.test(username.trim()))
    throw new AuthError("Tên tài khoản chỉ được dùng chữ cái, số và dấu gạch dưới.");
  if (!password || password.length < 6)
    throw new AuthError("Mật khẩu phải có ít nhất 6 ký tự.");

  const db = await getDb();
  if (await db.collection<UserRecord>("users").findOne({ usernameKey: username.trim().toLowerCase() })) {
    throw new AuthError("Tên tài khoản đã tồn tại, hãy chọn tên khác.");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user: User = {
    id: makeId(),
    username: username.trim(),
    displayName: username.trim(),
    passwordHash,
    avatar: `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(username.trim())}`,
    createdAt: new Date().toISOString(),
    favorites: [],
    favoriteActors: [],
    watchHistory: [],
    role: "user"
  };

  await saveUser(user);

  const token = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: TOKEN_TTL });
  return { user: toPublic(user), token };
}

export async function loginUser(payload: {
  username: string;
  password: string;
}): Promise<{ user: PublicUser; token: string }> {
  const { username, password } = payload;
  if (!username || !password)
    throw new AuthError("Vui lòng nhập tên tài khoản và mật khẩu.");

  const db = await getDb();
  const row = await db.collection<UserRecord>("users").findOne({ usernameKey: username.trim().toLowerCase() });
  const user = row ? decodeUser(row) : undefined;
  if (!user) throw new AuthError("Tên tài khoản hoặc mật khẩu không đúng.");

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) throw new AuthError("Tên tài khoản hoặc mật khẩu không đúng.");

  const token = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: TOKEN_TTL });
  return { user: toPublic(user), token };
}

export async function verifyToken(token: string): Promise<PublicUser | null> {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string };
    const user = await readUser(payload.sub);
    return user ? toPublic(user) : null;
  } catch {
    return null;
  }
}

export async function updateUserProfile(
  userId: string,
  payload: { displayName?: string; avatar?: string; avatarFrame?: string }
): Promise<PublicUser> {
  const user = await readUser(userId);
  if (!user) throw new AuthError("Người dùng không tồn tại.");

  if (payload.displayName !== undefined) {
    const name = payload.displayName.trim();
    if (name.length < 2) {
      throw new AuthError("Tên hiển thị phải có ít nhất 2 ký tự.");
    }
    user.displayName = name;
  }

  if (payload.avatar !== undefined) {
    user.avatar = payload.avatar.trim();
  }

  if (payload.avatarFrame !== undefined) {
    const frame = payload.avatarFrame.trim();
    if (frame) {
      if (ADMIN_ONLY_AVATAR_FRAMES.has(frame) && user.role !== "admin") {
        throw new AuthError("Khung avatar này chỉ dành cho admin.");
      }
      user.avatarFrame = frame;
    } else {
      delete user.avatarFrame;
    }
  }

  await saveUser(user);
  return toPublic(user);
}

export async function updateUserPassword(
  userId: string,
  payload: { oldPassword?: string; newPassword?: string }
): Promise<void> {
  const { oldPassword, newPassword } = payload;
  if (!oldPassword || !newPassword) {
    throw new AuthError("Vui lòng nhập mật khẩu cũ và mật khẩu mới.");
  }
  if (newPassword.length < 6) {
    throw new AuthError("Mật khẩu mới phải có ít nhất 6 ký tự.");
  }

  const user = await readUser(userId);
  if (!user) throw new AuthError("Người dùng không tồn tại.");

  const match = await bcrypt.compare(oldPassword, user.passwordHash);
  if (!match) throw new AuthError("Mật khẩu cũ không chính xác.");

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await saveUser(user);
}

export async function toggleUserFavorite(
  userId: string,
  payload: { type: "movie" | "actor"; movie?: FavoriteMovie; actorName?: string }
): Promise<PublicUser> {
  const user = await readUser(userId);
  if (!user) throw new AuthError("Người dùng không tồn tại.");

  if (!user.favorites) user.favorites = [];
  if (!user.favoriteActors) user.favoriteActors = [];

  if (payload.type === "movie") {
    if (!payload.movie || !payload.movie.slug) {
      throw new AuthError("Thông tin phim không hợp lệ.");
    }
    const movie = payload.movie;
    const index = user.favorites.findIndex((f) => f.slug === movie.slug);
    if (index === -1) {
      user.favorites.push(movie);
    } else {
      user.favorites.splice(index, 1);
    }
  } else if (payload.type === "actor") {
    if (!payload.actorName) {
      throw new AuthError("Tên diễn viên không hợp lệ.");
    }
    const actor = payload.actorName.trim();
    const index = user.favoriteActors.indexOf(actor);
    if (index === -1) {
      user.favoriteActors.push(actor);
    } else {
      user.favoriteActors.splice(index, 1);
    }
  }

  await saveUser(user);
  return toPublic(user);
}

export async function updateUserHistory(
  userId: string,
  item: Omit<WatchHistoryItem, "watchedAt">
): Promise<PublicUser> {
  const user = await readUser(userId);
  if (!user) throw new AuthError("Người dùng không tồn tại.");

  if (!user.watchHistory) user.watchHistory = [];

  // Remove existing history item for the same movie slug
  user.watchHistory = user.watchHistory.filter((h) => h.slug !== item.slug);

  // Prepend new history item
  user.watchHistory.unshift({
    ...item,
    watchedAt: new Date().toISOString()
  });

  // Limit history items to 40
  if (user.watchHistory.length > 40) {
    user.watchHistory = user.watchHistory.slice(0, 40);
  }

  await saveUser(user);
  return toPublic(user);
}

export async function toggleUserComicFollow(
  userId: string,
  payload: { slug: string; source: string; title: string; cover: string }
): Promise<PublicUser> {
  const user = await readUser(userId);
  if (!user) throw new AuthError("Người dùng không tồn tại.");
  if (!user.comicFollows) user.comicFollows = [];

  const index = user.comicFollows.findIndex(
    (f) => f.slug === payload.slug && f.source === payload.source
  );
  if (index === -1) {
    user.comicFollows.push({
      slug: payload.slug,
      source: payload.source,
      title: payload.title,
      cover: payload.cover,
      followedAt: new Date().toISOString()
    });
  } else {
    user.comicFollows.splice(index, 1);
  }

  await saveUser(user);
  return toPublic(user);
}

export async function updateUserComicHistory(
  userId: string,
  item: Omit<ComicHistoryServerItem, "updatedAt">
): Promise<PublicUser> {
  const user = await readUser(userId);
  if (!user) throw new AuthError("Người dùng không tồn tại.");
  if (!user.comicHistory) user.comicHistory = [];

  // Remove existing entry for same comic
  user.comicHistory = user.comicHistory.filter(
    (h) => !(h.slug === item.slug && h.source === item.source)
  );
  // Prepend new entry
  user.comicHistory.unshift({ ...item, updatedAt: new Date().toISOString() });
  // Limit to 60 items
  if (user.comicHistory.length > 60) {
    user.comicHistory = user.comicHistory.slice(0, 60);
  }

  await saveUser(user);
  return toPublic(user);
}

export async function deleteUserComicHistory(
  userId: string,
  payload: { slug: string; source: string }
): Promise<PublicUser> {
  const user = await readUser(userId);
  if (!user) throw new AuthError("Người dùng không tồn tại.");
  if (!user.comicHistory) user.comicHistory = [];

  user.comicHistory = user.comicHistory.filter(
    (h) => !(h.slug === payload.slug && h.source === payload.source)
  );

  await saveUser(user);
  return toPublic(user);
}

export async function adminResetUserPassword(targetUserId: string, newPassword: string): Promise<void> {
  if (!newPassword || newPassword.length < 6) {
    throw new AuthError("Mật khẩu mới phải có ít nhất 6 ký tự.");
  }

  const user = await readUser(targetUserId);
  if (!user) throw new AuthError("Người dùng không tồn tại.");

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await saveUser(user);
}

export class AuthError extends Error {
  status = 400;
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}
