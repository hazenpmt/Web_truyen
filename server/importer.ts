import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { uploadsDir } from "./storage";
import type { Chapter, Comic, ComicStatus } from "./types";
import * as cheerio from "cheerio";
import { fetchHtml, fetchChapterPages } from "./sync";

const MAX_MANIFEST_BYTES = 2 * 1024 * 1024;
const MAX_ASSET_BYTES = 15 * 1024 * 1024;
const MAX_CHAPTERS = 5000;
const MAX_PAGES = 500000;

type ManifestChapter = {
  title?: unknown;
  number?: unknown;
  pages?: unknown;
  imageUrls?: unknown;
};

type ComicManifest = {
  title?: unknown;
  slug?: unknown;
  altTitles?: unknown;
  author?: unknown;
  artist?: unknown;
  description?: unknown;
  status?: unknown;
  genres?: unknown;
  coverUrl?: unknown;
  cover?: unknown;
  source?: unknown;
  chapters?: unknown;
};

export class ImportError extends Error {
  status = 400;
}

export async function importComicFromPayload(
  payload: { manifest?: unknown; manifestUrl?: unknown; confirmRights?: unknown; cookie?: string },
  existingComics: Array<Pick<Comic, "slug">>
): Promise<Comic> {
  if (payload.confirmRights !== true) {
    throw new ImportError("Bạn cần xác nhận có quyền dùng và phân phối nguồn truyện này.");
  }

  const manifest = await resolveManifest(payload);
  const cookie = typeof payload.cookie === "string" ? payload.cookie : undefined;
  return manifestToComic(manifest, existingComics, cookie);
}

let resolvedTruyenQQDomain = "https://truyenqqko.com";
async function resolveTruyenQQDomain(): Promise<string> {
  try {
    const res = await fetch("https://flax.to/truyenqq", { method: "GET" });
    const finalUrl = new URL(res.url);
    resolvedTruyenQQDomain = finalUrl.origin;
    return resolvedTruyenQQDomain;
  } catch (err) {
    console.error("[Sync] Error resolving TruyenQQ domain:", err);
    return resolvedTruyenQQDomain;
  }
}

async function crawlHtmlToManifest(url: string): Promise<ComicManifest> {
  let targetUrl = url.trim();
  if (targetUrl.includes("flax.to")) {
    const activeDomain = await resolveTruyenQQDomain();
    targetUrl = targetUrl.replace(/https?:\/\/[^\/]+/, activeDomain);
  }

  console.log(`[Import] HTML crawl starting for URL: ${targetUrl}`);
  const html = await fetchHtml(targetUrl);
  const $ = cheerio.load(html);

  let title = "";
  let coverUrl = "";
  let description = "Chưa có mô tả.";
  let author = "Đang cập nhật";
  const genres: string[] = [];
  const chapters: Array<{ title: string; url: string }> = [];

  const isTruyenQQ = targetUrl.includes("truyenqq");
  const isTruyenGG = targetUrl.includes("truyengg");

  if (isTruyenQQ) {
    title = $(".book_detail h1").text().trim();
    coverUrl = $(".book_avatar img").attr("src") || "";
    description = $(".detail-content p").text().trim() || "Chưa có mô tả.";

    $(".info-item").each((_, el) => {
      const label = $(el).find(".label").text();
      if (label.includes("Tác giả")) {
        author = $(el).find(".detail-info").text().trim() || "Đang cập nhật";
      }
    });

    $(".list-tags a").each((_, el) => {
      genres.push($(el).text().trim());
    });

    $(".works-chapter-list a").each((_, el) => {
      const href = $(el).attr("href");
      const cTitle = $(el).text().trim() || "Chương mới";
      if (href && !href.includes("-chap-0") && !cTitle.includes("Đọc từ đầu")) {
        chapters.push({
          title: cTitle,
          url: new URL(href, targetUrl).toString()
        });
      }
    });
  } else if (isTruyenGG) {
    title = $(".post-title h1").text().trim();
    coverUrl = $(".summary_image img").attr("data-src") || $(".summary_image img").attr("src") || "";
    description = $(".description-summary").text().trim() || "Chưa có mô tả.";

    $(".author-content a").each((_, el) => {
      author = $(el).text().trim();
    });

    $(".genres-content a").each((_, el) => {
      genres.push($(el).text().trim());
    });

    $(".wp-manga-chapter a").each((_, el) => {
      const href = $(el).attr("href");
      const cTitle = $(el).text().trim() || "Chương mới";
      if (href) {
        chapters.push({
          title: cTitle,
          url: new URL(href, targetUrl).toString()
        });
      }
    });
  } else {
    throw new ImportError("Không hỗ trợ crawl từ trang web này. Chỉ hỗ trợ TruyenGG và TruyenQQ (flax.to).");
  }

  if (!title) {
    throw new ImportError("Không tìm thấy tên truyện. Vui lòng kiểm tra lại URL.");
  }

  // Reverse chapters so they are in chronological order (oldest chapter first)
  chapters.reverse();

  console.log(`[Import] Found ${chapters.length} chapters for "${title}". Crawling page details...`);

  const parsedChapters = [];
  for (let i = 0; i < chapters.length; i++) {
    const chap = chapters[i];
    const chapNumber = i + 1;
    try {
      console.log(`[Import] Crawling chapter ${chapNumber}/${chapters.length}: "${chap.title}"`);
      const pages = await fetchChapterPages(chap.url);
      if (pages.length > 0) {
        parsedChapters.push({
          title: chap.title,
          number: chapNumber,
          pages: pages.map(p => p.image)
        });
      }
      // Delay 1 second between chapters
      await new Promise(r => setTimeout(r, 1000));
    } catch (err) {
      console.error(`[Import] Error crawling chapter "${chap.title}":`, err);
    }
  }

  if (parsedChapters.length === 0) {
    throw new ImportError("Không crawl được chương truyện nào. Vui lòng kiểm tra lại nguồn.");
  }

  return {
    title,
    coverUrl,
    description,
    author,
    genres,
    source: {
      name: isTruyenQQ ? "TruyenQQ" : "TruyenGG",
      url: targetUrl
    },
    chapters: parsedChapters
  };
}

async function resolveManifest(payload: {
  manifest?: unknown;
  manifestUrl?: unknown;
}): Promise<ComicManifest> {
  if (typeof payload.manifestUrl === "string" && payload.manifestUrl.trim()) {
    const url = payload.manifestUrl.trim();
    if (url.includes("truyengg") || url.includes("truyenqq") || url.includes("flax.to")) {
      return crawlHtmlToManifest(url);
    }
    const response = await fetchWithTimeout(url, { accept: "application/json, text/plain;q=0.9" });
    if (!response.ok) {
      throw new ImportError(`Không tải được manifest: HTTP ${response.status}`);
    }
    const length = Number(response.headers.get("content-length") || 0);
    if (length > MAX_MANIFEST_BYTES) {
      throw new ImportError("Manifest quá lớn.");
    }
    const text = await response.text();
    if (Buffer.byteLength(text) > MAX_MANIFEST_BYTES) {
      throw new ImportError("Manifest quá lớn.");
    }
    return JSON.parse(text) as ComicManifest;
  }

  if (payload.manifest && typeof payload.manifest === "object") {
    return payload.manifest as ComicManifest;
  }

  throw new ImportError("Vui lòng nhập manifest JSON hoặc URL manifest.");
}

async function manifestToComic(manifest: ComicManifest, existingComics: Array<Pick<Comic, "slug">>, cookie?: string): Promise<Comic> {
  const title = requiredString(manifest.title, "title");
  const slug = uniqueSlug(
    slugify(optionalString(manifest.slug) || title),
    new Set(existingComics.map((comic) => comic.slug))
  );
  const now = new Date().toISOString();
  const rawChapters = asArray<ManifestChapter>(manifest.chapters, "chapters").slice(0, MAX_CHAPTERS);
  const chapterPageTotal = rawChapters.reduce((total, chapter) => {
    const rawPages = getChapterPages(chapter);
    return total + rawPages.length;
  }, 0);

  if (!rawChapters.length) {
    throw new ImportError("Manifest cần có ít nhất một chapter.");
  }
  if (chapterPageTotal > MAX_PAGES) {
    throw new ImportError(`Manifest vượt quá giới hạn ${MAX_PAGES} trang mỗi lần import.`);
  }

  const comicDir = path.join(uploadsDir, slug);
  await mkdir(comicDir, { recursive: true });

  const sourceUrlStr = typeof manifest.source === "object" && manifest.source !== null && "url" in manifest.source
    ? String((manifest.source as any).url)
    : "";
  const referer = sourceUrlStr ? new URL(sourceUrlStr).origin : undefined;
  const customHeaders: Record<string, string> = {
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  };
  if (referer) {
    customHeaders["referer"] = referer;
  }
  if (cookie) {
    customHeaders["cookie"] = cookie;
  }

  const coverUrl = optionalString(manifest.coverUrl) || optionalString(manifest.cover);
  const cover = coverUrl
    ? await resolveAsset(coverUrl, comicDir, `${slug}-cover`, customHeaders)
    : "/sample/covers/sky-market.svg";

  const chapters: Chapter[] = [];
  for (let index = 0; index < rawChapters.length; index += 1) {
    const rawChapter = rawChapters[index];
    const number = toNumber(rawChapter.number, index + 1);
    const chapterTitle = optionalString(rawChapter.title) || `Chương ${number}`;
    const chapterSlug = uniqueSlug(slugify(chapterTitle), new Set(chapters.map((chapter) => chapter.slug)));
    const rawPages = getChapterPages(rawChapter);

    if (!rawPages.length) {
      throw new ImportError(`Chapter "${chapterTitle}" chưa có trang ảnh.`);
    }

    const pages = [];
    for (let pageIndex = 0; pageIndex < rawPages.length; pageIndex += 1) {
      const pageUrl = rawPages[pageIndex];
      const image = await resolveAsset(pageUrl, comicDir, `${chapterSlug}-${pageIndex + 1}`, customHeaders);
      pages.push({ index: pageIndex + 1, image });
    }

    chapters.push({
      id: crypto.randomUUID(),
      slug: chapterSlug,
      number,
      title: chapterTitle,
      createdAt: now,
      pages
    });
  }

  chapters.sort((a, b) => a.number - b.number);

  return {
    id: crypto.randomUUID(),
    slug,
    title,
    altTitles: asOptionalStringArray(manifest.altTitles),
    author: optionalString(manifest.author) || "Đang cập nhật",
    artist: optionalString(manifest.artist),
    description: optionalString(manifest.description) || "Chưa có mô tả.",
    status: normalizeStatus(optionalString(manifest.status)),
    genres: asOptionalStringArray(manifest.genres),
    cover,
    rating: 0,
    views: 0,
    createdAt: now,
    updatedAt: now,
    source: normalizeSource(manifest.source),
    chapters
  };
}

function getChapterPages(chapter: ManifestChapter): string[] {
  const rawPages = Array.isArray(chapter.pages) ? chapter.pages : chapter.imageUrls;
  return asArray<unknown>(rawPages, "pages")
    .map((page) => {
      if (typeof page === "string") return page;
      if (page && typeof page === "object") {
        const record = page as Record<string, unknown>;
        return optionalString(record.imageUrl) || optionalString(record.url) || "";
      }
      return "";
    })
    .filter(Boolean);
}

async function resolveAsset(source: string, comicDir: string, baseName: string, customHeaders?: Record<string, string>): Promise<string> {
  return source;
}

async function fetchWithTimeout(url: string, headers: Record<string, string>) {
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new ImportError("URL manifest phải dùng http hoặc https.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    return await fetch(parsed, {
      headers: {
        "user-agent": "WebTruyenImporter/0.1 authorized-content-importer",
        ...headers
      },
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ImportError("Nguồn phản hồi quá lâu.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new ImportError(`Thiếu trường ${field}.`);
  }
  return value.trim();
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asArray<T>(value: unknown, field: string): T[] {
  if (!Array.isArray(value)) {
    throw new ImportError(`Trường ${field} phải là mảng.`);
  }
  return value as T[];
}

function asOptionalStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim());
}

function normalizeStatus(value?: string): ComicStatus {
  const normalized = removeMarks(value || "").toLowerCase();
  if (["completed", "complete", "done", "hoan thanh", "full"].includes(normalized)) return "completed";
  if (["paused", "dropped", "tam dung", "drop"].includes(normalized)) return "paused";
  return "ongoing";
}

function normalizeSource(value: unknown): Comic["source"] | undefined {
  if (!value || typeof value !== "object") return undefined;
  const source = value as Record<string, unknown>;
  return {
    name: optionalString(source.name),
    url: optionalString(source.url),
    license: optionalString(source.license)
  };
}

function toNumber(value: unknown, fallback: number) {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function uniqueSlug(base: string, taken: Set<string>) {
  const cleanBase = base || "truyen";
  let candidate = cleanBase;
  let index = 2;
  while (taken.has(candidate)) {
    candidate = `${cleanBase}-${index}`;
    index += 1;
  }
  return candidate;
}

function slugify(value: string) {
  return removeMarks(value)
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function removeMarks(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function extensionFor(contentType: string, pathname: string) {
  const byType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/svg+xml": "svg",
    "image/avif": "avif"
  };
  if (byType[contentType]) return byType[contentType];

  const extension = path.extname(pathname).replace(".", "").toLowerCase();
  if (["jpg", "jpeg", "png", "webp", "gif", "svg", "avif"].includes(extension)) {
    return extension === "jpeg" ? "jpg" : extension;
  }
  return "img";
}
