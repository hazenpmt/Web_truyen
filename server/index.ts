import cors from "cors";
import express from "express";
import crypto from "node:crypto";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import {
  AuthError,
  loginUser,
  registerUser,
  verifyToken,
  updateUserProfile,
  updateUserPassword,
  toggleUserFavorite,
  updateUserHistory,
  toggleUserComicFollow,
  updateUserComicHistory,
  deleteUserComicHistory,
  readUsers,
  writeUsers,
  toPublic,
  adminResetUserPassword
} from "./auth.js";
import { ImportError, importComicFromPayload } from "./importer";
import { startAutoSync, startTruyenQQCompareAutoSync, runTruyenQQCompareSync, readQQSyncResults, runTruyenQQSync, fetchChapterPages, startTruyenQQAutoSync, truyenQQSyncStatus, getTruyenQQTotalPagesEstimate } from "./sync";
import {
  ProviderError,
  getOTruyenCategories,
  getOTruyenChapter,
  getOTruyenComic,
  getVsmovMovie,
  listOTruyenComics,
  listVsmovMovies,
  getTruyenQQChapter,
  getTruyenQQComic,
  listTruyenQQRanking,
  listTruyenQQComics,
  TRUYENQQ_GENRES,
  getTruyenQQBaseUrl
} from "./providers";
import {
  comicToSummary,
  deleteComicBySlug,
  projectRoot,
  readComicBySlug,
  readComicIndex,
  uploadsDir,
  writeComicDirect
} from "./storage";
import type { Chapter, Comic, ComicSummary } from "./types";
import fs from "node:fs/promises";

type AccessLog = {
  timestamp: string;
  ip: string;
  method: string;
  url: string;
  username: string;
  action: string;
};

const LOGS_FILE = path.join(projectRoot, "data", "access_logs.json");
const CHAPTER_COMMENTS_FILE = path.join(projectRoot, "data", "chapter_comments.json");
const clientDistDir = path.join(projectRoot, "dist");
const maxImageProxyConcurrency = Math.max(1, Number(process.env.IMAGE_PROXY_CONCURRENCY || 4));
const accessLogsEnabled = process.env.ENABLE_ACCESS_LOGS === "1";
let activeImageProxyRequests = 0;
const imageProxyQueue: Array<() => void> = [];

let cachedLogs: AccessLog[] | null = null;
let logsLoadPromise: Promise<AccessLog[]> | null = null;
let logsFlushTimer: NodeJS.Timeout | null = null;
let logsWriteChain = Promise.resolve();

type ChapterComment = {
  id: string;
  name: string;
  text: string;
  sticker?: string;
  avatar?: string;
  avatarFrame?: string;
  parentId?: string;
  replyTo?: string;
  role?: "admin" | "user";
  createdAt: string;
};

type ChapterCommentsDb = Record<string, ChapterComment[]>;

let chapterCommentsCache: ChapterCommentsDb | null = null;
let chapterCommentsLoadPromise: Promise<ChapterCommentsDb> | null = null;
let chapterCommentsWriteChain = Promise.resolve();

async function readLogs(): Promise<AccessLog[]> {
  if (cachedLogs) return cachedLogs;
  if (logsLoadPromise) return logsLoadPromise;
  logsLoadPromise = readLogsFromDisk().then((logs) => {
    cachedLogs = logs;
    return logs;
  });
  return logsLoadPromise;
}

async function readLogsFromDisk(): Promise<AccessLog[]> {
  try {
    const raw = await fs.readFile(LOGS_FILE, "utf-8");
    return JSON.parse(raw) as AccessLog[];
  } catch {
    return [];
  }
}

async function writeLogs(logs: AccessLog[]): Promise<void> {
  await fs.mkdir(path.dirname(LOGS_FILE), { recursive: true });
  await fs.writeFile(LOGS_FILE, JSON.stringify(logs, null, 2), "utf-8");
}

function chapterCommentKey(source: string, comicSlug: string, chapterSlug: string) {
  return [source || "local", comicSlug, chapterSlug].map((part) => encodeURIComponent(part)).join(":");
}

function cleanCommentText(value: unknown, maxLength: number) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

async function readChapterComments(): Promise<ChapterCommentsDb> {
  if (chapterCommentsCache) return chapterCommentsCache;
  if (chapterCommentsLoadPromise) return chapterCommentsLoadPromise;
  chapterCommentsLoadPromise = fs.readFile(CHAPTER_COMMENTS_FILE, "utf-8")
    .then((raw) => JSON.parse(raw) as ChapterCommentsDb)
    .catch(() => ({}))
    .then((comments) => {
      chapterCommentsCache = comments;
      return comments;
    })
    .finally(() => {
      chapterCommentsLoadPromise = null;
    });
  return chapterCommentsLoadPromise;
}

async function writeChapterComments(comments: ChapterCommentsDb): Promise<void> {
  chapterCommentsCache = comments;
  chapterCommentsWriteChain = chapterCommentsWriteChain.then(async () => {
    await fs.mkdir(path.dirname(CHAPTER_COMMENTS_FILE), { recursive: true });
    await fs.writeFile(CHAPTER_COMMENTS_FILE, JSON.stringify(comments, null, 2), "utf-8");
  });
  return chapterCommentsWriteChain;
}

function enqueueAccessLog(log: AccessLog) {
  readLogs()
    .then((logs) => {
      logs.unshift(log);
      if (logs.length > 2000) logs.length = 2000;
      scheduleLogsFlush();
    })
    .catch((err) => console.error("Error queueing access log:", err));
}

function scheduleLogsFlush() {
  if (logsFlushTimer) return;
  logsFlushTimer = setTimeout(() => {
    logsFlushTimer = null;
    const snapshot = cachedLogs ? [...cachedLogs] : [];
    logsWriteChain = logsWriteChain
      .then(() => writeLogs(snapshot))
      .catch((err) => console.error("Error writing access log:", err));
  }, 1000);
}

async function acquireImageProxySlot() {
  if (activeImageProxyRequests >= maxImageProxyConcurrency) {
    await new Promise<void>((resolve) => imageProxyQueue.push(resolve));
  }
  activeImageProxyRequests += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeImageProxyRequests = Math.max(0, activeImageProxyRequests - 1);
    imageProxyQueue.shift()?.();
  };
}

const app = express();
const port = Number(process.env.PORT || process.env.API_PORT || 3001);

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(uploadsDir));
app.use("/sample", express.static(path.join(projectRoot, "public", "sample")));

app.use("/api", async (req, res, next) => {
  if (!accessLogsEnabled || req.path === "/health" || req.path === "/proxy/image" || req.path.startsWith("/admin/logs")) {
    next();
    return;
  }

  try {
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";
    const ipStr = Array.isArray(ip) ? ip[0] : ip;
    
    let username = "Khách ẩn danh";
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (token) {
      const user = await verifyToken(token);
      if (user) {
        username = user.username;
      }
    }

    let action = `${req.method} ${req.path}`;
    if (req.path.startsWith("/providers/movies/")) {
      const slug = req.path.split("/").pop();
      action = `Xem phim: ${slug}`;
    } else if (req.path.startsWith("/providers/comics/") && req.path.includes("/chapters/")) {
      const parts = req.path.split("/");
      action = `Đọc truyện API: ${parts[3]} - Chương ${parts[5]}`;
    } else if (req.path.startsWith("/providers/comics/")) {
      const slug = req.path.split("/").pop();
      action = `Xem truyện API: ${slug}`;
    } else if (req.path.startsWith("/comics/") && req.path.includes("/chapters/")) {
      const parts = req.path.split("/");
      action = `Đọc truyện local: ${parts[2]} - Chương ${parts[4]}`;
    } else if (req.path.startsWith("/comics/")) {
      const slug = req.path.split("/").pop();
      action = `Xem truyện local: ${slug}`;
    } else if (req.path === "/auth/login") {
      action = `Đăng nhập hệ thống`;
    } else if (req.path === "/auth/register") {
      action = `Đăng ký tài khoản`;
    } else if (req.path === "/import/manifest") {
      action = `Nạp truyện bằng manifest`;
    }

    const newLog: AccessLog = {
      timestamp: new Date().toISOString(),
      ip: ipStr.replace("::ffff:", ""),
      method: req.method,
      url: req.originalUrl,
      username,
      action
    };

    enqueueAccessLog(newLog);
  } catch (err) {
    console.error("Error writing access log:", err);
  }
  next();
});

app.get("/api/health", (_request, response) => {
  response.json({ ok: true });
});

app.get("/api/proxy/image", async (request, response, next) => {
  const release = await acquireImageProxySlot();
  try {
    const imageUrl = request.query.url;
    if (typeof imageUrl !== "string" || !imageUrl.startsWith("http")) {
      response.status(400).send("Invalid image URL");
      return;
    }
    const imgRes = await fetch(imageUrl, {
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "referer": "https://truyenqqko.com/"
      }
    });
    if (!imgRes.ok) {
      response.status(imgRes.status).send("Failed to fetch image");
      return;
    }
    const contentType = imgRes.headers.get("content-type") || "image/jpeg";
    response.setHeader("Content-Type", contentType);
    response.setHeader("Cache-Control", "public, max-age=604800, immutable");
    const contentLength = imgRes.headers.get("content-length");
    if (contentLength) {
      response.setHeader("Content-Length", contentLength);
    }
    if (!imgRes.body) {
      response.status(502).send("Empty image response");
      return;
    }
    await pipeline(Readable.fromWeb(imgRes.body as any), response);
  } catch (error) {
    next(error);
  } finally {
    release();
  }
});

app.get("/api/meta", async (_request, response, next) => {
  try {
    const comics = await readComicIndex();
    const genres = [...new Set(comics.flatMap((comic) => comic.genres))].sort((a, b) => a.localeCompare(b, "vi"));
    response.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
    response.json({
      genres,
      statuses: [
        { value: "ongoing", label: "Đang ra" },
        { value: "completed", label: "Hoàn thành" },
        { value: "paused", label: "Tạm dừng" }
      ]
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/providers/comics/meta", async (_request, response, next) => {
  try {
    const categories = await getOTruyenCategories();
    response.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
    response.json({
      genres: categories,
      statuses: [
        { value: "truyen-moi", label: "Truyện mới" },
        { value: "dang-phat-hanh", label: "Đang phát hành" },
        { value: "hoan-thanh", label: "Hoàn thành" },
        { value: "sap-ra-mat", label: "Sắp ra mắt" }
      ]
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/providers/comics", async (request, response, next) => {
  try {
    const payload = await listOTruyenComics({
      search: textValue(request.query.search),
      category: textValue(request.query.category),
      type: textValue(request.query.type),
      page: Number(request.query.page || 1)
    });
    response.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    response.json(payload);
  } catch (error) {
    next(error);
  }
});

app.get("/api/providers/comics/:slug", async (request, response, next) => {
  try {
    response.json(await getOTruyenComic(request.params.slug));
  } catch (error) {
    next(error);
  }
});

app.get("/api/providers/comics/:slug/chapters/:chapterKey", async (request, response, next) => {
  try {
    response.json(await getOTruyenChapter(request.params.slug, request.params.chapterKey));
  } catch (error) {
    next(error);
  }
});

// ── TruyenQQ Crawler Routes ────────────────────────────────────────

app.get("/api/providers/truyenqq/meta", async (_request, response, next) => {
  try {
    response.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
    response.json({
      genres: TRUYENQQ_GENRES,
      statuses: [
        { value: "truyen-moi", label: "Mới cập nhật" }
      ]
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/providers/truyenqq", async (request, response, next) => {
  try {
    const payload = await listTruyenQQComics({
      search: textValue(request.query.search),
      category: textValue(request.query.category),
      page: Number(request.query.page || 1),
      limit: Number(request.query.limit || 24)
    });
    response.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    response.json(payload);
  } catch (error) {
    next(error);
  }
});

app.get("/api/providers/truyenqq/ranking", async (request, response, next) => {
  try {
    const requestedType = textValue(request.query.type);
    const type = requestedType === "week" || requestedType === "month" ? requestedType : "day";
    response.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
    response.json({ items: await listTruyenQQRanking(type) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/providers/truyenqq/:slug", async (request, response, next) => {
  try {
    response.json(await getTruyenQQComic(request.params.slug));
  } catch (error) {
    next(error);
  }
});

app.get("/api/providers/truyenqq/:slug/chapters/:chapterSlug", async (request, response, next) => {
  try {
    response.json(await getTruyenQQChapter(request.params.slug, request.params.chapterSlug));
  } catch (error) {
    next(error);
  }
});

app.get("/api/providers/movies", async (request, response, next) => {
  try {
    response.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    response.json(
      await listVsmovMovies({
        search: textValue(request.query.search),
        type: textValue(request.query.type),
        page: Number(request.query.page || 1),
        limit: Number(request.query.limit || 24)
      })
    );
  } catch (error) {
    next(error);
  }
});

app.get("/api/providers/movies/:slug", async (request, response, next) => {
  try {
    response.json(await getVsmovMovie(request.params.slug));
  } catch (error) {
    next(error);
  }
});

app.get("/api/comics", async (request, response, next) => {
  try {
    const comics = await readComicIndex();
    const search = textValue(request.query.search);
    const genre = textValue(request.query.genre);
    const status = textValue(request.query.status);
    const page = clampPage(request.query.page);
    const limit = clampLimit(request.query.limit);

    const filtered = comics
      .filter((comic) => matchesSearch(comic, search))
      .filter((comic) => !genre || comic.genres.includes(genre))
      .filter((comic) => !status || comic.status === status)
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));

    const totalItems = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));
    const currentPage = Math.min(page, totalPages);
    const startIndex = (currentPage - 1) * limit;

    response.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    response.json({
      items: filtered.slice(startIndex, startIndex + limit),
      pagination: {
        totalItems,
        totalItemsPerPage: limit,
        currentPage,
        totalPages
      }
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/comics/:slug", async (request, response, next) => {
  try {
    const comic = await readComicBySlug(request.params.slug);
    if (!comic) {
      response.status(404).json({ message: "Không tìm thấy truyện." });
      return;
    }
    response.json(sortComicChapters(comic));
  } catch (error) {
    next(error);
  }
});

app.get("/api/comics/:slug/chapters/:chapterSlug", async (request, response, next) => {
  try {
    const comic = await readComicBySlug(request.params.slug);
    if (!comic) {
      response.status(404).json({ message: "Không tìm thấy truyện." });
      return;
    }

    const chapters = [...comic.chapters].sort((a, b) => a.number - b.number);
    const index = chapters.findIndex((chapter) => chapter.slug === request.params.chapterSlug);
    if (index === -1) {
      response.status(404).json({ message: "Không tìm thấy chapter." });
      return;
    }

    const summary = toSummary({ ...comic, chapters });
    const chapter = chapters[index];
    
    if (comic.source?.name === "TruyenQQ" && (!chapter.pages || chapter.pages.length === 0)) {
      try {
        const activeDomain = await getTruyenQQBaseUrl();
        const chapterUrl = `${activeDomain.replace(/\/$/, "")}/truyen-tranh/${chapter.slug}`;
        const pages = await fetchChapterPages(chapterUrl);
        chapter.pages = pages.map(p => ({
          index: p.index,
          image: `/api/proxy/image?url=${encodeURIComponent(p.image)}`
        }));
        await writeComicDirect({ ...comic, chapters });
        console.log(`[API] Saved fetched chapter pages for "${comic.title}" - "${chapter.title}" to database.`);
      } catch (err) {
        console.error(`[API] Error fetching TruyenQQ pages live:`, err);
      }
    }

    response.json({
      comic: summary,
      chapter: chapter,
      previousChapter: chapterLink(chapters[index - 1]),
      nextChapter: chapterLink(chapters[index + 1])
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/comments/chapters", async (request, response, next) => {
  try {
    const source = textValue(request.query.source) || "local";
    const comicSlug = textValue(request.query.comicSlug);
    const chapterSlug = textValue(request.query.chapterSlug);
    if (!comicSlug || !chapterSlug) {
      response.status(400).json({ message: "Thiếu comicSlug hoặc chapterSlug." });
      return;
    }

    const comments = await readChapterComments();
    const key = chapterCommentKey(source, comicSlug, chapterSlug);
    response.setHeader("Cache-Control", "no-store");
    response.json({ comments: comments[key] || [] });
  } catch (error) {
    next(error);
  }
});

app.post("/api/comments/chapters", async (request, response, next) => {
  try {
    const source = cleanCommentText(request.body?.source, 32) || "local";
    const comicSlug = cleanCommentText(request.body?.comicSlug, 140);
    const chapterSlug = cleanCommentText(request.body?.chapterSlug, 180);
    const name = cleanCommentText(request.body?.name, 60) || "Bạn đọc";
    const text = cleanCommentText(request.body?.text, 1500);
    const sticker = cleanCommentText(request.body?.sticker, 160);
    const parentId = cleanCommentText(request.body?.parentId, 80);
    const replyTo = cleanCommentText(request.body?.replyTo, 60);
    const auth = request.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    const user = token ? await verifyToken(token) : null;

    if (!comicSlug || !chapterSlug || (!text && !sticker)) {
      response.status(400).json({ message: "Thiếu thông tin bình luận." });
      return;
    }

    const comments = await readChapterComments();
    const key = chapterCommentKey(source, comicSlug, chapterSlug);
    const role: ChapterComment["role"] = user?.role === "admin" ? "admin" : "user";
    const avatar = user?.avatar ? cleanCommentText(user.avatar, 24000) : "";
    const avatarFrame = user?.avatarFrame ? cleanCommentText(user.avatarFrame, 80) : "";
    const nextComments: ChapterComment[] = [
      {
        id: crypto.randomUUID(),
        name,
        text,
        ...(sticker ? { sticker } : {}),
        ...(avatar ? { avatar } : {}),
        ...(avatarFrame ? { avatarFrame } : {}),
        ...(parentId ? { parentId, replyTo } : {}),
        role,
        createdAt: new Date().toISOString()
      },
      ...(comments[key] || [])
    ].slice(0, 200);
    comments[key] = nextComments;
    await writeChapterComments(comments);
    response.status(201).json({ comments: nextComments });
  } catch (error) {
    next(error);
  }
});

async function requireAdmin(request: express.Request, response: express.Response, next: express.NextFunction) {
  try {
    const auth = request.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) {
      response.status(401).json({ message: "Chưa đăng nhập." });
      return;
    }
    const user = await verifyToken(token);
    if (!user || user.role !== "admin") {
      response.status(403).json({ message: "Từ chối truy cập. Bạn không phải Admin." });
      return;
    }
    (request as any).user = user;
    next();
  } catch (error) {
    next(error);
  }
}

app.post("/api/import/manifest", requireAdmin, async (request, response, next) => {
  try {
    const comics = await readComicIndex();
    const comic = await importComicFromPayload(request.body, comics);
    await writeComicDirect(comic);
    response.status(201).json({ comic: toSummary(comic) });
  } catch (error) {
    next(error);
  }
});

// ── Admin routes ─────────────────────────────────────────────────
app.get("/api/admin/stats", requireAdmin, async (_request, response, next) => {
  try {
    const users = await readUsers();
    const comics = await readComicIndex();
    
    let onlineMoviesCount = 0;
    let onlineComicsCount = 0;
    
    try {
      const [moviesPayload, comicsPayload] = await Promise.all([
        listVsmovMovies({ page: 1, limit: 1 }),
        listOTruyenComics({ page: 1 })
      ]);
      onlineMoviesCount = moviesPayload.pagination.totalItems;
      onlineComicsCount = comicsPayload.pagination.totalItems;
    } catch (apiError) {
      console.error("Error fetching online stats:", apiError);
      onlineMoviesCount = 9999;
      onlineComicsCount = 8888;
    }

    response.json({
      totalUsers: users.length,
      importedComics: comics.length,
      onlineMovies: onlineMoviesCount,
      onlineComics: onlineComicsCount,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/logs", requireAdmin, async (_request, response, next) => {
  try {
    const logs = await readLogs();
    
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTodayISO = startOfToday.toISOString();
    
    const todayLogs = logs.filter(log => log.timestamp >= startOfTodayISO);
    
    const ipCounts: Record<string, number> = {};
    const activityCounts: Record<string, number> = {};
    const userCounts: Record<string, number> = {};
    
    for (const log of todayLogs) {
      ipCounts[log.ip] = (ipCounts[log.ip] || 0) + 1;
      
      if (!log.action.includes("GET ") && !log.action.includes("POST ") && !log.action.includes("PUT ") && !log.action.includes("DELETE ")) {
        activityCounts[log.action] = (activityCounts[log.action] || 0) + 1;
      }
      
      if (log.username !== "Khách ẩn danh") {
        userCounts[log.username] = (userCounts[log.username] || 0) + 1;
      }
    }
    
    const topIPs = Object.entries(ipCounts)
      .map(([ip, count]) => ({ ip, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
      
    const topActivities = Object.entries(activityCounts)
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
      
    const activeUsers = Object.entries(userCounts)
      .map(([username, count]) => ({ username, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
      
    response.json({
      recentLogs: logs.slice(0, 200),
      todayStats: {
        totalRequests: todayLogs.length,
        uniqueIPs: Object.keys(ipCounts).length,
        topIPs,
        topActivities,
        activeUsers
      }
    });
  } catch (error) {
    next(error);
  }
});

function isToday(dateStr?: string): boolean {
  if (!dateStr) return false;
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const offset = 7 * 60 * 60 * 1000; // GMT+7
    const dVN = new Date(d.getTime() + offset);
    const nowVN = new Date(now.getTime() + offset);
    return (
      dVN.getUTCFullYear() === nowVN.getUTCFullYear() &&
      dVN.getUTCMonth() === nowVN.getUTCMonth() &&
      dVN.getUTCDate() === nowVN.getUTCDate()
    );
  } catch {
    return false;
  }
}

app.get("/api/admin/today-updates", requireAdmin, async (_request, response, next) => {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    const todayStr = formatter.format(new Date());

    // 1. Local Comics
    const localComics = await readComicIndex();
    const updatedLocalComics = localComics
      .filter(c => isToday(c.updatedAt))
      .map(c => ({
        title: c.title,
        slug: c.slug,
        updatedAt: c.updatedAt,
        type: "Local Comic",
        info: `${c.totalChapters} chap`
      }));
      
    // 2. Online Comics (OTruyen)
    let updatedOnlineComics: any[] = [];
    try {
      const comicsPayload = await listOTruyenComics({ page: 1, type: "truyen-moi" });
      updatedOnlineComics = (comicsPayload.items || [])
        .filter(c => isToday(c.updatedAt))
        .map(c => ({
          title: c.title,
          slug: c.slug,
          updatedAt: c.updatedAt,
          type: "OTruyen API",
          info: `${c.totalChapters || "?"} chap`
        }));
    } catch (err) {
      console.error("Error fetching online comics for today updates:", err);
    }
    
    // 3. Online Movies (Vsmov)
    let updatedOnlineMovies: any[] = [];
    try {
      const moviesPayload = await listVsmovMovies({ page: 1 });
      updatedOnlineMovies = (moviesPayload.items || [])
        .filter((m: any) => isToday(m.updatedAt))
        .map((m: any) => ({
          title: m.title,
          slug: m.slug,
          updatedAt: m.updatedAt,
          type: `Phim API (${m.type === "series" ? "Bộ" : "Lẻ"})`,
          info: m.year ? String(m.year) : ""
        }));
    } catch (err) {
      console.error("Error fetching online movies for today updates:", err);
    }
    
    response.json({
      localComics: updatedLocalComics,
      onlineComics: updatedOnlineComics,
      onlineMovies: updatedOnlineMovies,
      todayDate: todayStr
    });
  } catch (error) {
    next(error);
  }
});

// Get TruyenQQ comparison results
app.get("/api/admin/truyenqq-sync/compare", requireAdmin, async (_request, response, next) => {
  try {
    const results = await readQQSyncResults();
    response.json(results || { status: "idle", progress: "Chưa chạy lần nào.", results: [] });
  } catch (error) {
    next(error);
  }
});

// Trigger TruyenQQ comparison sync
app.post("/api/admin/truyenqq-sync/compare", requireAdmin, async (request, response, next) => {
  try {
    const pages = Number(request.body?.pages || 5);
    // Run in background, return immediately
    runTruyenQQCompareSync(pages).catch(err => console.error("TruyenQQ compare sync error:", err));
    response.json({ ok: true, message: `Đã bắt đầu so sánh ${pages} trang gần đây từ TruyenQQ. Kiểm tra kết quả sau vài phút.` });
  } catch (error) {
    next(error);
  }
});

// Trigger TruyenQQ background sync crawler
app.post("/api/admin/truyenqq-sync", requireAdmin, async (request, response, next) => {
  try {
    const shouldCrawlAll = request.body?.all === true || String(request.body?.pages || "").toLowerCase() === "all";
    const pages = shouldCrawlAll ? await getTruyenQQTotalPagesEstimate() : Number(request.body?.pages || 5);
    // Run in background, return immediately
    runTruyenQQSync(pages).catch(err => console.error("TruyenQQ sync error:", err));
    response.json({
      ok: true,
      pages,
      mode: shouldCrawlAll ? "all" : "partial",
      message: shouldCrawlAll
        ? `Đã bắt đầu cào toàn bộ TruyenQQ (${pages} trang ước tính). Tiến trình chạy nền và sẽ mất nhiều giờ.`
        : `Đã bắt đầu cào ngầm ${pages} trang truyện từ TruyenQQ vào database. Tiến trình đang chạy nền.`
    });
  } catch (error) {
    next(error);
  }
});

// Get TruyenQQ background sync crawler status
app.get("/api/admin/truyenqq-sync/status", requireAdmin, async (_request, response, next) => {
  try {
    const comics = await readComicIndex();
    const truyenQQComicsCount = comics.filter(c => c.source?.name === "TruyenQQ").length;
    const totalPages = await getTruyenQQTotalPagesEstimate();
    const estimatedTotal = totalPages * 36;
    response.json({
      status: truyenQQSyncStatus,
      localCount: truyenQQComicsCount,
      estimatedTotal: estimatedTotal,
      estimatedTotalPages: totalPages
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/users", requireAdmin, async (_request, response, next) => {
  try {
    const users = await readUsers();
    response.json(users.map(toPublic));
  } catch (error) {
    next(error);
  }
});

app.put("/api/admin/users/:id/role", requireAdmin, async (request, response, next) => {
  try {
    const targetUserId = request.params.id;
    const { role } = request.body;
    if (role !== "admin" && role !== "user") {
      response.status(400).json({ message: "Vai trò không hợp lệ." });
      return;
    }

    const currentAdminUser = (request as any).user;
    if (currentAdminUser.id === targetUserId) {
      response.status(400).json({ message: "Bạn không thể tự thay đổi vai trò của chính mình." });
      return;
    }

    const users = await readUsers();
    const targetUser = users.find((u) => u.id === targetUserId);
    if (!targetUser) {
      response.status(404).json({ message: "Không tìm thấy người dùng." });
      return;
    }

    if (targetUser.username.toLowerCase() === "admin" && role !== "admin") {
      response.status(400).json({ message: "Không thể hạ cấp tài khoản admin hệ thống chính." });
      return;
    }

    targetUser.role = role;
    await writeUsers(users);
    response.json({ ok: true, user: toPublic(targetUser) });
  } catch (error) {
    next(error);
  }
});

app.put("/api/admin/users/:id/password", requireAdmin, async (request, response, next) => {
  try {
    const targetUserId = request.params.id as string;
    const { newPassword } = request.body;
    await adminResetUserPassword(targetUserId, String(newPassword || ""));
    response.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/admin/users/:id", requireAdmin, async (request, response, next) => {
  try {
    const targetUserId = request.params.id;
    const currentAdminUser = (request as any).user;
    if (currentAdminUser.id === targetUserId) {
      response.status(400).json({ message: "Bạn không thể tự xóa tài khoản của chính mình." });
      return;
    }

    const users = await readUsers();
    const index = users.findIndex((u) => u.id === targetUserId);
    if (index === -1) {
      response.status(404).json({ message: "Không tìm thấy người dùng." });
      return;
    }

    const targetUser = users[index];
    if (targetUser.username.toLowerCase() === "admin") {
      response.status(400).json({ message: "Không thể xóa tài khoản admin hệ thống chính." });
      return;
    }

    users.splice(index, 1);
    await writeUsers(users);
    response.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/admin/comics/:slug", requireAdmin, async (request, response, next) => {
  try {
    const slug = String(request.params.slug);
    const deleted = await deleteComicBySlug(slug);
    if (!deleted) {
      response.status(404).json({ message: "Không tìm thấy truyện." });
      return;
    }

    response.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// ── Auth routes ──────────────────────────────────────────────────
app.post("/api/auth/register", async (request, response, next) => {
  try {
    const result = await registerUser(request.body);
    response.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/login", async (request, response, next) => {
  try {
    const result = await loginUser(request.body);
    response.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/me", async (request, response) => {
  const auth = request.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) { response.status(401).json({ message: "Chưa đăng nhập." }); return; }
  const user = await verifyToken(token);
  if (!user) { response.status(401).json({ message: "Phiên đăng nhập hết hạn." }); return; }
  response.json({ user });
});

app.put("/api/user/profile", async (request, response, next) => {
  try {
    const auth = request.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) { response.status(401).json({ message: "Chưa đăng nhập." }); return; }
    
    const user = await verifyToken(token);
    if (!user) { response.status(401).json({ message: "Phiên đăng nhập hết hạn." }); return; }

    const updatedUser = await updateUserProfile(user.id, request.body);
    response.json({ ok: true, user: updatedUser });
  } catch (error) {
    next(error);
  }
});

app.put("/api/user/password", async (request, response, next) => {
  try {
    const auth = request.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) { response.status(401).json({ message: "Chưa đăng nhập." }); return; }
    
    const user = await verifyToken(token);
    if (!user) { response.status(401).json({ message: "Phiên đăng nhập hết hạn." }); return; }

    await updateUserPassword(user.id, request.body);
    response.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.post("/api/user/favorites/toggle", async (request, response, next) => {
  try {
    const auth = request.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) { response.status(401).json({ message: "Chưa đăng nhập." }); return; }
    
    const user = await verifyToken(token);
    if (!user) { response.status(401).json({ message: "Phiên đăng nhập hết hạn." }); return; }

    const updatedUser = await toggleUserFavorite(user.id, request.body);
    response.json({ ok: true, user: updatedUser });
  } catch (error) {
    next(error);
  }
});

app.post("/api/user/history", async (request, response, next) => {
  try {
    const auth = request.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) { response.status(401).json({ message: "Chưa đăng nhập." }); return; }
    
    const user = await verifyToken(token);
    if (!user) { response.status(401).json({ message: "Phiên đăng nhập hết hạn." }); return; }

    const updatedUser = await updateUserHistory(user.id, request.body);
    response.json({ ok: true, user: updatedUser });
  } catch (error) {
    next(error);
  }
});

app.post("/api/user/comic-follows/toggle", async (request, response, next) => {
  try {
    const auth = request.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) { response.status(401).json({ message: "Chưa đăng nhập." }); return; }
    const user = await verifyToken(token);
    if (!user) { response.status(401).json({ message: "Phiên đăng nhập hết hạn." }); return; }
    const updatedUser = await toggleUserComicFollow(user.id, request.body);
    response.json({ ok: true, user: updatedUser });
  } catch (error) {
    next(error);
  }
});

app.post("/api/user/comic-history", async (request, response, next) => {
  try {
    const auth = request.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) { response.status(401).json({ message: "Chưa đăng nhập." }); return; }
    const user = await verifyToken(token);
    if (!user) { response.status(401).json({ message: "Phiên đăng nhập hết hạn." }); return; }
    const updatedUser = await updateUserComicHistory(user.id, request.body);
    response.json({ ok: true, user: updatedUser });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/user/comic-history", async (request, response, next) => {
  try {
    const auth = request.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) { response.status(401).json({ message: "Chưa đăng nhập." }); return; }
    const user = await verifyToken(token);
    if (!user) { response.status(401).json({ message: "Phiên đăng nhập hết hạn." }); return; }
    const updatedUser = await deleteUserComicHistory(user.id, request.body);
    response.json({ ok: true, user: updatedUser });
  } catch (error) {
    next(error);
  }
});

app.use(express.static(clientDistDir, {
  index: false,
  maxAge: "1h",
  setHeaders(response, filePath) {
    if (filePath.includes(`${path.sep}assets${path.sep}`)) {
      response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    }
  }
}));

app.use((request, response, next) => {
  if (request.method !== "GET" || request.path.startsWith("/api")) {
    next();
    return;
  }

  response.sendFile(path.join(clientDistDir, "index.html"), (error) => {
    if (error) next(error);
  });
});

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  if (error instanceof AuthError) {
    response.status(error.status).json({ message: error.message });
    return;
  }

  if (error instanceof ProviderError) {
    response.status(error.status).json({ message: error.message });
    return;
  }

  if (error instanceof ImportError) {
    response.status(error.status).json({ message: error.message });
    return;
  }

  if (error instanceof SyntaxError) {
    response.status(400).json({ message: "JSON không hợp lệ." });
    return;
  }

  console.error(error);
  response.status(500).json({ message: "Server gặp lỗi." });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`API running on http://localhost:${port}`);
  setTimeout(() => {
    listVsmovMovies({ page: 1, limit: 16 }).catch(err => console.error("[Warmup] Movie list warmup error:", err));
    readComicIndex().catch(err => console.error("[Warmup] Comic index warmup error:", err));
  }, 1000);
  startAutoSync();          // sync local comics every 1h
  startTruyenQQCompareAutoSync();  // compare TruyenQQ vs OTruyen every 24h
  startTruyenQQAutoSync();  // crawl & sync TruyenQQ homepage updates
});

function toSummary(comic: Comic): ComicSummary {
  return comicToSummary(comic);
}

function sortComicChapters(comic: Comic): Comic {
  return {
    ...comic,
    chapters: [...comic.chapters].sort((a, b) => a.number - b.number)
  };
}

function chapterLink(chapter?: Chapter) {
  if (!chapter) return undefined;
  return {
    slug: chapter.slug,
    number: chapter.number,
    title: chapter.title,
    createdAt: chapter.createdAt
  };
}

function matchesSearch(comic: Comic | ComicSummary, search: string) {
  if (!search) return true;
  const haystack = normalize(
    [comic.title, comic.author, comic.artist, comic.description, ...(comic.altTitles || []), ...comic.genres].join(" ")
  );
  return haystack.includes(normalize(search));
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase();
}

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function clampPage(value: unknown) {
  const page = Number(value || 1);
  if (!Number.isFinite(page)) return 1;
  return Math.max(1, Math.trunc(page));
}

function clampLimit(value: unknown) {
  const limit = Number(value || 24);
  if (!Number.isFinite(limit)) return 24;
  return Math.min(60, Math.max(1, Math.trunc(limit)));
}
