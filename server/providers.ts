import * as cheerio from "cheerio";
import fs from "node:fs/promises";
import path from "node:path";
import type { Chapter, Comic, ComicPage, ComicStatus, ComicSummary } from "./types";
import { projectRoot, readComicBySlug, readComicIndex, writeComicDirect } from "./storage";

const OTRUYEN_BASE = "https://otruyenapi.com/v1/api";
const OTRUYEN_IMAGE_BASE = "https://img.otruyenapi.com/uploads/comics";
const VSMOV_BASE = "https://phimapi.com";

const OTRUYEN_CACHE_FILE = path.join(projectRoot, "data", "otruyen_detail_cache.json");
const VSMOV_CACHE_FILE = path.join(projectRoot, "data", "vsmov_detail_cache.json");
const VSMOV_LIST_CACHE_FILE = path.join(projectRoot, "data", "vsmov_list_cache.json");
const OTRUYEN_CHAP_CACHE_FILE = path.join(projectRoot, "data", "otruyen_chapter_cache.json");

let otruyenCache: Record<string, { data: any; timestamp: number }> = {};
let vsmovCache: Record<string, { data: any; timestamp: number }> = {};
let otruyenChapCache: Record<string, { data: any; timestamp: number }> = {};
const otruyenListCache = new Map<string, { data: any; timestamp: number }>();
const movieListCache = new Map<string, { data: any; timestamp: number }>();
const truyenQQRankingCache = new Map<string, { data: ComicSummary[]; timestamp: number }>();

async function loadDetailCaches() {
  try {
    const raw = await fs.readFile(OTRUYEN_CACHE_FILE, "utf8");
    otruyenCache = JSON.parse(raw);
  } catch {}
  try {
    const raw = await fs.readFile(VSMOV_CACHE_FILE, "utf8");
    vsmovCache = JSON.parse(raw);
  } catch {}
  try {
    const raw = await fs.readFile(VSMOV_LIST_CACHE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    Object.entries(parsed || {}).forEach(([key, value]) => {
      movieListCache.set(key, value as { data: any; timestamp: number });
    });
  } catch {}
  try {
    const raw = await fs.readFile(OTRUYEN_CHAP_CACHE_FILE, "utf8");
    otruyenChapCache = JSON.parse(raw);
  } catch {}
}
await loadDetailCaches();

async function hydrateMovieListCacheFromDisk() {
  try {
    const raw = await fs.readFile(VSMOV_LIST_CACHE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    Object.entries(parsed || {}).forEach(([key, value]) => {
      movieListCache.set(key, value as { data: any; timestamp: number });
    });
  } catch {}
}

function findFallbackMovieList(page: number, limit: number) {
  const preferredKeys = [
    `__${page}_${limit}`,
    `__1_${limit}`,
    "__1_16",
    "__1_8"
  ];
  for (const key of preferredKeys) {
    const cached = movieListCache.get(key);
    if (cached?.data?.items?.length) return cached.data;
  }
  const latest = [...movieListCache.values()]
    .filter((entry) => entry?.data?.items?.length)
    .sort((a, b) => b.timestamp - a.timestamp)[0];
  return latest?.data;
}

export class ProviderError extends Error {
  status = 400;
}

type OTruyenCategory = {
  name?: string;
  slug?: string;
};

type OTruyenChapterItem = {
  filename?: string;
  chapter_name?: string;
  chapter_title?: string;
  chapter_api_data?: string;
};

type OTruyenItem = {
  _id?: string;
  name?: string;
  slug?: string;
  origin_name?: string[];
  status?: string;
  thumb_url?: string;
  content?: string;
  author?: string[];
  category?: OTruyenCategory[];
  updatedAt?: string;
  chaptersLatest?: OTruyenChapterItem[];
  chapters?: Array<{ server_name?: string; server_data?: OTruyenChapterItem[] }>;
};

type OTruyenListPayload = {
  data?: {
    items?: OTruyenItem[];
    params?: {
      pagination?: {
        totalItems?: number;
        totalItemsPerPage?: number;
        currentPage?: number;
        pageRanges?: number;
      };
    };
  };
};

type OTruyenDetailPayload = {
  data?: {
    item?: OTruyenItem;
  };
};

type OTruyenChapterPayload = {
  data?: {
    domain_cdn?: string;
    item?: {
      chapter_name?: string;
      chapter_title?: string;
      chapter_path?: string;
      chapter_image?: Array<{ image_page?: number; image_file?: string }>;
    };
  };
};

export type ProviderComicList = {
  items: ComicSummary[];
  pagination: {
    totalItems: number;
    totalItemsPerPage: number;
    currentPage: number;
    totalPages: number;
  };
};

export type ProviderMovieSummary = {
  id: string;
  slug: string;
  title: string;
  originTitle: string;
  poster: string;
  thumb: string;
  year?: number;
  rating: number;
  type?: string;
  updatedAt?: string;
};

export type ProviderMovieDetail = ProviderMovieSummary & {
  description: string;
  status?: string;
  quality?: string;
  language?: string;
  episodeCurrent?: string;
  episodeTotal?: string;
  duration?: string;
  trailerUrl?: string;
  categories: string[];
  countries: string[];
  actors: string[];
  directors: string[];
  episodes: ProviderMovieServer[];
};

export type ProviderMovieServer = {
  serverName: string;
  episodes: ProviderMovieEpisode[];
};

export type ProviderMovieEpisode = {
  name: string;
  slug: string;
  filename: string;
  embedUrl?: string;
  streamUrl?: string;
};

type VsmovMovie = {
  _id?: string | number;
  name?: string;
  origin_name?: string;
  slug?: string;
  poster_url?: unknown;
  thumb_url?: unknown;
  year?: number;
  tmdb?: {
    type?: string;
    vote_average?: string | number;
  };
  modified?: { time?: string };
  content?: string;
  type?: string;
  status?: string;
  quality?: string;
  lang?: string;
  episode_current?: string;
  episode_total?: string;
  time?: string;
  trailer_url?: string;
  category?: Array<{ name?: string; slug?: string }>;
  country?: Array<{ name?: string; slug?: string }>;
  actor?: string[];
  director?: string[];
};

type VsmovListPayload = {
  status?: boolean;
  items?: VsmovMovie[];
  pagination?: {
    totalItems?: number;
    totalItemsPerPage?: number | string;
    currentPage?: number;
    totalPages?: number;
  };
};

type VsmovDetailPayload = {
  status?: boolean;
  movie?: VsmovMovie;
  episodes?: Array<{
    server_name?: string;
    server_data?: Array<{
      name?: string;
      slug?: string;
      filename?: string;
      link_embed?: string | null;
      link_m3u8?: string | null;
    }>;
  }>;
};

export async function listOTruyenComics(query: {
  search?: string;
  category?: string;
  type?: string;
  page?: number;
}): Promise<ProviderComicList> {
  const page = clampPage(query.page);
  const cacheKey = `${query.search || ""}_${query.category || ""}_${query.type || ""}_${page}`;
  const cached = otruyenListCache.get(cacheKey);
  const now = Date.now();
  if (cached && now - cached.timestamp < 24 * 60 * 60 * 1000) { // 24 hours TTL
    return cached.data;
  }

  let path = `/danh-sach/${encodeURIComponent(query.type || "truyen-moi")}?page=${page}`;

  if (query.search) {
    path = `/tim-kiem?keyword=${encodeURIComponent(query.search)}&page=${page}`;
  } else if (query.category) {
    path = `/the-loai/${encodeURIComponent(query.category)}?page=${page}`;
  }

  try {
    const payload = await fetchJson<OTruyenListPayload>(`${OTRUYEN_BASE}${path}`);
    const pagination = payload.data?.params?.pagination || {};
    const totalItems = Number(pagination.totalItems || 0);
    const totalItemsPerPage = Number(pagination.totalItemsPerPage || 24);
    const result: ProviderComicList = {
      items: (payload.data?.items || []).map(mapOTruyenSummary),
      pagination: {
        totalItems,
        totalItemsPerPage,
        currentPage: Number(pagination.currentPage || page),
        totalPages: Math.max(1, Math.ceil(totalItems / totalItemsPerPage))
      }
    };

    otruyenListCache.set(cacheKey, { data: result, timestamp: now });
    return result;
  } catch (err) {
    console.error("[OTruyen API] Request error/timeout, serving fallback local comics:", err);
    const localComics = await readComicIndex();
    return {
      items: localComics,
      pagination: {
        totalItems: localComics.length,
        totalItemsPerPage: 24,
        currentPage: 1,
        totalPages: 1
      }
    };
  }
}

export async function getOTruyenCategories() {
  const payload = await fetchJson<{ data?: { items?: OTruyenCategory[] } }>(`${OTRUYEN_BASE}/the-loai`);
  return (payload.data?.items || [])
    .map((item) => ({ name: item.name || "", slug: item.slug || "" }))
    .filter((item) => item.name && item.slug);
}

export async function getOTruyenComic(slug: string): Promise<Comic> {
  const cached = otruyenCache[slug];
  const now = Date.now();
  if (cached && (now - cached.timestamp < 21600000)) { // 6 hours TTL
    return cached.data;
  }

  const payload = await fetchJson<OTruyenDetailPayload>(`${OTRUYEN_BASE}/truyen-tranh/${encodeURIComponent(slug)}`);
  const item = payload.data?.item;
  if (!item?.slug) {
    throw new ProviderError("Không tìm thấy truyện từ OTruyen.");
  }

  const result = mapOTruyenDetail(item);
  otruyenCache[slug] = { data: result, timestamp: now };
  fs.writeFile(OTRUYEN_CACHE_FILE, JSON.stringify(otruyenCache, null, 2)).catch(() => {});
  return result;
}

export async function getOTruyenChapter(comicSlug: string, chapterKey: string) {
  const cacheKey = `${comicSlug}_${chapterKey}`;
  const cached = otruyenChapCache[cacheKey];
  const now = Date.now();
  if (cached && (now - cached.timestamp < 30 * 24 * 3600 * 1000)) { // 30 days TTL
    return cached.data;
  }

  const comic = await getOTruyenComic(comicSlug);
  const chapters = comic.chapters;
  const index = chapters.findIndex((chapter) => chapter.slug === chapterKey);
  const chapterMeta = chapters[index];
  if (!chapterMeta) {
    throw new ProviderError("Không tìm thấy chương từ OTruyen.");
  }

  const chapterApiUrl = decodeChapterKey(chapterKey);
  const payload = await fetchJson<OTruyenChapterPayload>(chapterApiUrl);
  const item = payload.data?.item;
  const domain = payload.data?.domain_cdn || "";
  const chapterPath = item?.chapter_path || "";
  const pages: ComicPage[] = (item?.chapter_image || [])
    .filter((page) => page.image_file)
    .map((page, index) => ({
      index: index + 1,
      image: `${domain}/${chapterPath}/${page.image_file}`
    }));

  if (!pages.length) {
    throw new ProviderError("Chương này chưa có ảnh trang.");
  }

  const result = {
    comic: toProviderSummary(comic),
    chapter: {
      ...chapterMeta,
      title: chapterMeta.title || `Chương ${item?.chapter_name || index + 1}`,
      pages
    },
    previousChapter: chapterLink(chapters[index - 1]),
    nextChapter: chapterLink(chapters[index + 1])
  };

  otruyenChapCache[cacheKey] = { data: result, timestamp: now };
  fs.writeFile(OTRUYEN_CHAP_CACHE_FILE, JSON.stringify(otruyenChapCache, null, 2)).catch(() => {});
  return result;
}

export async function listVsmovMovies(query: { search?: string; type?: string; page?: number; limit?: number }) {
  const page = clampPage(query.page);
  const limit = Math.min(36, Math.max(8, Number(query.limit || 24)));
  const cacheKey = `${query.search || ""}_${query.type || ""}_${page}_${limit}`;
  let cached = movieListCache.get(cacheKey);
  if (!cached) {
    await hydrateMovieListCacheFromDisk();
    cached = movieListCache.get(cacheKey);
  }
  const now = Date.now();
  if (cached && now - cached.timestamp < 24 * 60 * 60 * 1000) { // 24 hours TTL
    return cached.data;
  }
  
  let isV1 = false;
  let url = `${VSMOV_BASE}/danh-sach/phim-moi-cap-nhat?page=${page}`;

  if (query.search) {
    url = `${VSMOV_BASE}/v1/api/tim-kiem?keyword=${encodeURIComponent(query.search)}&page=${page}`;
    isV1 = true;
  } else if (query.type === "series") {
    url = `${VSMOV_BASE}/v1/api/danh-sach/phim-bo?page=${page}`;
    isV1 = true;
  } else if (query.type === "single") {
    url = `${VSMOV_BASE}/v1/api/danh-sach/phim-le?page=${page}`;
    isV1 = true;
  } else if (query.type === "hoat-hinh") {
    url = `${VSMOV_BASE}/v1/api/danh-sach/hoat-hinh?page=${page}`;
    isV1 = true;
  } else if (query.type === "han-quoc") {
    url = `${VSMOV_BASE}/v1/api/quoc-gia/han-quoc?page=${page}`;
    isV1 = true;
  } else if (query.type === "trung-quoc") {
    url = `${VSMOV_BASE}/v1/api/quoc-gia/trung-quoc?page=${page}`;
    isV1 = true;
  } else if (query.type === "au-my") {
    url = `${VSMOV_BASE}/v1/api/quoc-gia/au-my?page=${page}`;
    isV1 = true;
  }

  let payload: any;
  try {
    payload = await fetchJson<any>(url);
  } catch (error) {
    if (cached) return cached.data;
    const fallback = findFallbackMovieList(page, limit);
    if (fallback) return fallback;
    throw error;
  }

  let result;
  if (isV1) {
    const data = payload.data || {};
    const items = data.items || [];
    const pagination = data.params?.pagination || {};
    const cdnImage = data.APP_DOMAIN_CDN_IMAGE || "https://phimimg.com";

    const mappedItems = items.map((item: any) => {
      return {
        id: String(item._id || item.slug || ""),
        slug: item.slug || "",
        title: item.name || "Không rõ tên",
        originTitle: item.origin_name || "",
        poster: item.poster_url ? (item.poster_url.startsWith("http") ? item.poster_url : `${cdnImage}/${item.poster_url}`) : "/sample/covers/neon-district.svg",
        thumb: item.thumb_url ? (item.thumb_url.startsWith("http") ? item.thumb_url : `${cdnImage}/${item.thumb_url}`) : "/sample/covers/neon-district.svg",
        year: item.year,
        rating: Number(item.tmdb?.vote_average || 0),
        type: item.tmdb?.type || item.type,
        updatedAt: item.modified?.time
      };
    });

    result = {
      items: mappedItems,
      pagination: {
        totalItems: Number(pagination.totalItems || 0),
        totalItemsPerPage: Number(pagination.totalItemsPerPage || limit),
        currentPage: Number(pagination.currentPage || page),
        totalPages: Number(pagination.totalPages || 1)
      }
    };
  } else {
    const pagination = payload.pagination || {};
    result = {
      items: (payload.items || []).map(mapVsmovSummary),
      pagination: {
        totalItems: Number(pagination.totalItems || 0),
        totalItemsPerPage: Number(pagination.totalItemsPerPage || limit),
        currentPage: Number(pagination.currentPage || page),
        totalPages: Number(pagination.totalPages || 1)
      }
    };
  }

  movieListCache.set(cacheKey, { data: result, timestamp: now });
  fs.writeFile(VSMOV_LIST_CACHE_FILE, JSON.stringify(Object.fromEntries(movieListCache), null, 2)).catch(() => {});
  return result;
}

export async function getVsmovMovie(slug: string): Promise<ProviderMovieDetail> {
  const cached = vsmovCache[slug];
  const now = Date.now();
  const cachedHasStreamUrl = Boolean(cached?.data?.episodes?.some((server: ProviderMovieServer) =>
    server.episodes?.some((episode) => episode.streamUrl)
  ));
  if (cached && cachedHasStreamUrl && (now - cached.timestamp < 21600000)) { // 6 hours TTL
    return cached.data;
  }

  const payload = await fetchJson<VsmovDetailPayload>(`${VSMOV_BASE}/phim/${encodeURIComponent(slug)}`);
  if (!payload.movie?.slug) {
    throw new ProviderError("Không tìm thấy phim từ hệ thống.");
  }

  const result = {
    ...mapVsmovSummary(payload.movie),
    description: payload.movie.content || "Chưa có mô tả.",
    status: payload.movie.status,
    quality: payload.movie.quality,
    language: payload.movie.lang,
    episodeCurrent: payload.movie.episode_current,
    episodeTotal: payload.movie.episode_total,
    duration: payload.movie.time,
    trailerUrl: payload.movie.trailer_url,
    categories: (payload.movie.category || []).map((item) => item.name || "").filter(Boolean),
    countries: (payload.movie.country || []).map((item) => item.name || "").filter(Boolean),
    actors: payload.movie.actor || [],
    directors: payload.movie.director || [],
    episodes: (payload.episodes || []).map((server) => ({
      serverName: server.server_name || "Server",
      episodes: (server.server_data || []).map((episode) => ({
        name: episode.name || episode.filename || "Tập",
        slug: episode.slug || slugify(episode.name || episode.filename || "tap"),
        filename: episode.filename || episode.name || "",
        embedUrl: episode.link_embed || undefined,
        streamUrl: episode.link_m3u8 || undefined
      }))
    }))
  };

  vsmovCache[slug] = { data: result, timestamp: now };
  fs.writeFile(VSMOV_CACHE_FILE, JSON.stringify(vsmovCache, null, 2)).catch(() => {});
  return result;
}

function mapOTruyenSummary(item: OTruyenItem) {
  const latest = item.chaptersLatest?.[0];
  const latestChapterNumber = Number(latest?.chapter_name || 0);
  return {
    id: item._id || item.slug || "",
    slug: item.slug || "",
    title: item.name || "Không rõ tên",
    altTitles: item.origin_name || [],
    author: "OTruyen",
    description: "Dữ liệu từ OTruyen API.",
    status: mapComicStatus(item.status),
    genres: (item.category || []).map((category) => category.name || "").filter(Boolean),
    cover: coverUrl(item.thumb_url),
    rating: 0,
    views: 0,
    createdAt: item.updatedAt || new Date().toISOString(),
    updatedAt: item.updatedAt || new Date().toISOString(),
    source: {
      name: "OTruyen API",
      url: `https://otruyen.cc/truyen-tranh/${item.slug || ""}`,
      license: "Public API"
    },
    totalChapters: Number.isFinite(latestChapterNumber) ? latestChapterNumber : 0,
    latestChapter: latest?.chapter_api_data
      ? {
          slug: encodeChapterKey(latest.chapter_api_data),
          number: Number(latest.chapter_name || 0),
          title: latest.chapter_title || `Chương ${latest.chapter_name || "mới"}`,
          createdAt: item.updatedAt || new Date().toISOString()
        }
      : undefined
  };
}

function mapOTruyenDetail(item: OTruyenItem): Comic {
  const serverData = item.chapters?.[0]?.server_data || [];
  const chapters = serverData
    .filter((chapter) => chapter.chapter_api_data)
    .map((chapter, index): Chapter => {
      const number = Number(chapter.chapter_name || index + 1);
      return {
        id: chapter.chapter_api_data || `${item.slug}-${index}`,
        slug: encodeChapterKey(chapter.chapter_api_data || `${item.slug}-${index}`),
        number: Number.isFinite(number) ? number : index + 1,
        title: chapter.chapter_title || `Chương ${chapter.chapter_name || index + 1}`,
        createdAt: item.updatedAt || new Date().toISOString(),
        pages: []
      };
    })
    .sort((a, b) => a.number - b.number);

  return {
    id: item._id || item.slug || "",
    slug: item.slug || "",
    title: item.name || "Không rõ tên",
    altTitles: item.origin_name || [],
    author: (item.author || []).join(", ") || "Đang cập nhật",
    description: stripHtml(item.content || ""),
    status: mapComicStatus(item.status),
    genres: (item.category || []).map((category) => category.name || "").filter(Boolean),
    cover: coverUrl(item.thumb_url),
    rating: 0,
    views: 0,
    createdAt: item.updatedAt || new Date().toISOString(),
    updatedAt: item.updatedAt || new Date().toISOString(),
    source: {
      name: "OTruyen API",
      url: `https://otruyen.cc/truyen-tranh/${item.slug || ""}`,
      license: "Public API"
    },
    chapters
  };
}

function toProviderSummary(comic: Comic) {
  const chapters = [...comic.chapters].sort((a, b) => a.number - b.number);
  const latestChapter = chapters.at(-1);
  const { chapters: _chapters, ...summary } = comic;
  return {
    ...summary,
    totalChapters: chapters.length,
    latestChapter: latestChapter ? chapterLink(latestChapter) : undefined
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

function mapVsmovSummary(movie: VsmovMovie): ProviderMovieSummary {
  return {
    id: String(movie._id || movie.slug || ""),
    slug: movie.slug || "",
    title: movie.name || "Không rõ tên",
    originTitle: movie.origin_name || "",
    poster: imageValue(movie.poster_url) || imageValue(movie.thumb_url),
    thumb: imageValue(movie.thumb_url) || imageValue(movie.poster_url),
    year: movie.year,
    rating: Number(movie.tmdb?.vote_average || 0),
    type: movie.tmdb?.type || movie.type,
    updatedAt: movie.modified?.time
  };
}

function coverUrl(value?: string) {
  if (!value) return "/sample/covers/sky-market.svg";
  if (/^https?:\/\//i.test(value)) return value;
  return `${OTRUYEN_IMAGE_BASE}/${value.replace(/^\/?uploads\/comics\//, "")}`;
}

function imageValue(value: unknown) {
  return typeof value === "string" && value ? value : "/sample/covers/neon-district.svg";
}

function mapComicStatus(status?: string): ComicStatus {
  if (status === "completed") return "completed";
  if (status === "coming_soon") return "paused";
  return "ongoing";
}

function stripHtml(value: string) {
  const text = cheerio.load(value).text().replace(/\s+/g, " ").trim();
  return text || "Chưa có mô tả.";
}

function encodeChapterKey(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeChapterKey(value: string) {
  const decoded = Buffer.from(value, "base64url").toString("utf8");
  if (!/^https:\/\/sv\d+\.otruyencdn\.com\/v1\/api\/chapter\//.test(decoded)) {
    throw new ProviderError("Chapter key không hợp lệ.");
  }
  return decoded;
}

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "WebTruyen/0.1 API-provider-client"
      },
      signal: controller.signal
    });
    if (!response.ok) {
      throw new ProviderError(`API trả về HTTP ${response.status}.`);
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new ProviderError("API phản hồi quá lâu.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, {
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "vi,en-US;q=0.9,en;q=0.8",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      signal: controller.signal
    });
    if (!response.ok) {
      throw new ProviderError(`API trả về HTTP ${response.status}.`);
    }
    return await response.text();
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new ProviderError("API phản hồi quá lâu.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function clampPage(value: unknown) {
  const page = Number(value || 1);
  if (!Number.isFinite(page)) return 1;
  return Math.max(1, Math.trunc(page));
}

function clampLimit(value: unknown) {
  const limit = Number(value || 24);
  if (!Number.isFinite(limit)) return 24;
  return Math.min(36, Math.max(8, Math.trunc(limit)));
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ── TruyenQQ Crawler Provider ──────────────────────────────────────

export const TRUYENQQ_GENRES = [
  { name: "Action", slug: "action-26" },
  { name: "Adventure", slug: "adventure-27" },
  { name: "Anime", slug: "anime-62" },
  { name: "Chuyển Sinh", slug: "chuyen-sinh-91" },
  { name: "Cổ Đại", slug: "co-dai-90" },
  { name: "Comedy", slug: "comedy-28" },
  { name: "Comic", slug: "comic-60" },
  { name: "Demons", slug: "demons-99" },
  { name: "Detective", slug: "detective-100" },
  { name: "Doujinshi", slug: "doujinshi-96" },
  { name: "Drama", slug: "drama-29" },
  { name: "Fantasy", slug: "fantasy-30" },
  { name: "Gender Bender", slug: "gender-bender-45" },
  { name: "Harem", slug: "harem-47" },
  { name: "Historical", slug: "historical-51" },
  { name: "Horror", slug: "horror-44" },
  { name: "Huyền Huyễn", slug: "huyen-huyen-468" },
  { name: "Isekai", slug: "isekai-85" },
  { name: "Josei", slug: "josei-54" },
  { name: "Mafia", slug: "mafia-69" },
  { name: "Magic", slug: "magic-58" },
  { name: "Manga", slug: "manga-469" },
  { name: "Manhua", slug: "manhua-35" },
  { name: "Manhwa", slug: "manhwa-49" },
  { name: "Martial Arts", slug: "martial-arts-41" },
  { name: "Military", slug: "military-101" },
  { name: "Mystery", slug: "mystery-39" },
  { name: "Ngôn Tình", slug: "ngon-tinh-87" },
  { name: "One shot", slug: "one-shot-95" },
  { name: "Psychological", slug: "psychological-40" },
  { name: "Romance", slug: "romance-36" },
  { name: "School Life", slug: "school-life-37" },
  { name: "Sci-fi", slug: "sci-fi-43" },
  { name: "Seinen", slug: "seinen-42" },
  { name: "Shoujo", slug: "shoujo-38" },
  { name: "Shoujo Ai", slug: "shoujo-ai-98" },
  { name: "Shounen", slug: "shounen-31" },
  { name: "Shounen Ai", slug: "shounen-ai-86" },
  { name: "Slice of life", slug: "slice-of-life-46" },
  { name: "Sports", slug: "sports-57" },
  { name: "Supernatural", slug: "supernatural-32" },
  { name: "Tragedy", slug: "tragedy-52" },
  { name: "Trọng Sinh", slug: "trong-sinh-82" },
  { name: "Truyện Màu", slug: "truyen-mau-92" },
  { name: "Webtoon", slug: "webtoon-55" },
  { name: "Xuyên Không", slug: "xuyen-khong-88" }
];

let cachedTruyenQQUrl = "https://truyenqqko.com/";
let lastResolvedTime = 0;

export async function getTruyenQQBaseUrl(): Promise<string> {
  const now = Date.now();
  if (now - lastResolvedTime < 10 * 60 * 1000) {
    return cachedTruyenQQUrl;
  }
  try {
    const res = await fetch("https://flax.to/truyenqq", {
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    if (res.url) {
      cachedTruyenQQUrl = res.url;
      lastResolvedTime = now;
      console.log(`[Providers] Resolved TruyenQQ active mirror: ${cachedTruyenQQUrl}`);
    }
  } catch (err) {
    console.error("[Providers] Error resolving TruyenQQ base URL, using cached:", err);
  }
  return cachedTruyenQQUrl;
}

export async function listTruyenQQComics(query: {
  search?: string;
  category?: string;
  page?: number;
  limit?: number;
}): Promise<ProviderComicList> {
  const page = clampPage(query.page);
  const limit = clampLimit(query.limit);

  const comics = await readComicIndex();
  let filtered = comics.filter((c) => c.source?.name === "TruyenQQ");

  // Search filter
  if (query.search) {
    const searchLower = query.search
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d");
    filtered = filtered.filter((c) => {
      const titleClean = c.title
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d");
      const authorClean = c.author
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d");
      const descClean = c.description
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d");
      return (
        titleClean.includes(searchLower) ||
        authorClean.includes(searchLower) ||
        descClean.includes(searchLower)
      );
    });
  }

  // Genre filter
  if (query.category) {
    const genreObj = TRUYENQQ_GENRES.find((g) => g.slug === query.category);
    if (genreObj) {
      filtered = filtered.filter((c) => c.genres.includes(genreObj.name));
    }
  }

  // Sort by updatedAt descending
  filtered.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));

  const totalItems = filtered.length;
  const startIndex = (page - 1) * limit;
  const pageItems = filtered.slice(startIndex, startIndex + limit);

  const items = pageItems;

  return {
    items,
    pagination: {
      totalItems,
      totalItemsPerPage: limit,
      currentPage: page,
      totalPages: Math.max(1, Math.ceil(totalItems / limit))
    }
  };
}

function numberFromText(text: string) {
  const match = text.match(/[\d,.]+/);
  if (!match) return 0;
  return Number(match[0].replace(/[,.]/g, "")) || 0;
}

function chapterNumberFromText(text: string) {
  const match = text.match(/(?:chapter|chap|chương)\s*(\d+(?:\.\d+)?)/i) || text.match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) || 0 : 0;
}

export async function listTruyenQQRanking(type: "day" | "week" | "month" = "day"): Promise<ComicSummary[]> {
  const cacheKey = type;
  const cached = truyenQQRankingCache.get(cacheKey);
  const now = Date.now();
  if (cached && now - cached.timestamp < 10 * 60 * 1000) return cached.data;

  const pathByType = {
    day: "top-ngay",
    week: "top-tuan",
    month: "top-thang"
  } as const;
  const baseUrl = await getTruyenQQBaseUrl();
  const html = await fetchText(`${baseUrl.replace(/\/$/, "")}/${pathByType[type]}`);
  const $ = cheerio.load(html);
  const index = await readComicIndex();
  const localBySlug = new Map(index.filter((comic) => comic.source?.name === "TruyenQQ").map((comic) => [comic.slug, comic]));
  const items: ComicSummary[] = [];
  const seen = new Set<string>();

  $(".list_grid_out ul li").each((idx, el) => {
    const detailAnchor = $(el)
      .find("a[href*='/truyen-tranh/']")
      .filter((_, anchor) => !String($(anchor).attr("href") || "").includes("-chap-"))
      .first();
    const href = detailAnchor.attr("href") || "";
    const slug = href.match(/\/truyen-tranh\/([^/?#\s]+)/)?.[1] || "";
    if (!slug || seen.has(slug)) return;
    seen.add(slug);

    const local = localBySlug.get(slug);
    const title = detailAnchor.text().trim() || $(el).find(".book_name a").first().text().trim() || $(el).find("img").first().attr("alt") || local?.title || slug;
    const coverUrl = $(el).find("img").first().attr("src") || $(el).find("img").first().attr("data-original") || "";
    const chapterAnchor = $(el).find("a[href*='-chap-']").first();
    const chapterTitle = chapterAnchor.text().trim() || local?.latestChapter?.title || "";
    const chapterSlug = chapterAnchor.attr("href")?.match(/\/truyen-tranh\/([^/?#\s]+)/)?.[1] || local?.latestChapter?.slug || "";
    const rawText = $(el).text().replace(/\s+/g, " ").trim();
    const viewMatch = rawText.match(/Lượt xem:\s*([\d,.]+)/i);
    const views = viewMatch ? numberFromText(viewMatch[1]) : local?.views || 0;
    const chapterNumber = chapterNumberFromText(chapterTitle || String(local?.totalChapters || ""));

    items.push({
      id: local?.id || slug,
      slug,
      title,
      cover: local?.cover || (coverUrl ? `/api/proxy/image?url=${encodeURIComponent(coverUrl)}` : "/sample/covers/sky-market.svg"),
      author: local?.author || "TruyenQQ",
      description: local?.description || "Truyện trong bảng xếp hạng TruyenQQ.",
      genres: local?.genres || [],
      status: local?.status || "ongoing",
      rating: local?.rating || 0,
      createdAt: local?.createdAt || new Date(now - idx * 60000).toISOString(),
      updatedAt: local?.updatedAt || new Date(now - idx * 60000).toISOString(),
      views,
      totalChapters: local?.totalChapters || chapterNumber || 0,
      latestChapter: chapterTitle && chapterSlug ? {
        slug: chapterSlug,
        number: chapterNumber,
        title: chapterTitle,
        createdAt: local?.latestChapter?.createdAt || new Date(now - idx * 60000).toISOString()
      } : local?.latestChapter
    });
  });

  const result = items.slice(0, 20);
  truyenQQRankingCache.set(cacheKey, { data: result, timestamp: now });
  return result;
}

const comicCache = new Map<string, { data: Comic; timestamp: number }>();

export async function getTruyenQQComic(slug: string): Promise<Comic> {
  // 1. Try to find in database
  const found = await readComicBySlug(slug);
  if (found) {
    return found;
  }

  // 2. Fallback to live cache memory check
  const cached = comicCache.get(slug);
  const now = Date.now();
  if (cached && now - cached.timestamp < 10 * 60 * 1000) { // Cache for 10 minutes
    return cached.data;
  }

  const baseUrl = await getTruyenQQBaseUrl();
  const url = `${baseUrl.replace(/\/$/, "")}/truyen-tranh/${slug}`;

  const res = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "referer": baseUrl
    }
  });

  if (!res.ok) {
    throw new ProviderError(`Không tìm thấy truyện từ TruyenQQ. HTTP ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  const title = $(".book_detail h1, .info-item h1, .book_info h1, h1").first().text().trim() || slug;
  const coverUrl = $(".book_avatar img").attr("src") || "";
  const cover = coverUrl ? `/api/proxy/image?url=${encodeURIComponent(coverUrl)}` : "/sample/covers/sky-market.svg";
  const description = $(".detail-content, .excerpt").first().text().trim() || "Chưa có mô tả.";

  let author = "Đang cập nhật";
  $(".info-detail .row, .book_info .row, .info-item, .book_info p, .book_info li, .info-detail li, .info-detail p").each((_, el) => {
    const name = $(el).find(".name").text().trim();
    if (name.includes("Tác giả")) {
      author = $(el).find(".col-xs-9").text().trim() || author;
    } else {
      const text = $(el).text();
      if (text.includes("Tác giả") && !text.includes("Nhóm dịch")) {
        const parts = text.split("Tác giả");
        const possible = parts[1]?.replace(":", "").trim();
        if (possible) author = possible;
      }
    }
  });

  const genres: string[] = [];
  $("li.li03 a[href*='/the-loai/'], .list-tags p, .list-tags a, .genres a").each((_, el) => {
    genres.push($(el).text().trim());
  });

  const chapters: Chapter[] = [];
  $(".works-chapter-list a, .list-chapters a").each((index, el) => {
    const href = $(el).attr("href") || "";
    const cTitle = $(el).text().trim() || `Chương ${index + 1}`;
    if (!href || href.includes("-chap-0") || cTitle.includes("Đọc từ đầu") || cTitle.includes("Đọc mới nhất")) {
      return;
    }

    const cSlugMatch = href.match(/\/truyen-tranh\/([^/?#\s]+)/);
    const cSlug = cSlugMatch ? cSlugMatch[1] : href.split("/").pop() || "";
    if (!cSlug) return;

    const numberMatch = cTitle.match(/\d+(\.\d+)?/);
    const number = numberMatch ? parseFloat(numberMatch[0]) : index + 1;

    chapters.push({
      id: cSlug,
      slug: cSlug,
      number,
      title: cTitle,
      createdAt: new Date().toISOString(),
      pages: []
    });
  });

  chapters.reverse();

  const comic: Comic = {
    id: slug,
    slug,
    title,
    altTitles: [],
    author,
    description,
    status: "ongoing" as const,
    genres,
    cover,
    rating: 0,
    views: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    source: {
      name: "TruyenQQ",
      url,
      license: "Crawl"
    },
    chapters
  };

  // Save the live-crawled comic to the local database so it is fast next time
  await writeComicDirect(comic);
  console.log(`[Providers] Live-crawled & saved missing TruyenQQ comic "${title}" to database.`);

  comicCache.set(slug, { data: comic, timestamp: Date.now() });
  return comic;
}

export async function getTruyenQQChapter(comicSlug: string, chapterSlug: string) {
  // 1. Get comic (either from DB or fetched live and saved)
  const comic = await getTruyenQQComic(comicSlug);
  const chapters = comic.chapters;
  const index = chapters.findIndex((chapter) => chapter.slug === chapterSlug);
  const currentChapter = index !== -1 ? chapters[index] : undefined;

  if (!currentChapter) {
    throw new ProviderError("Không tìm thấy chương trong truyện.");
  }

  // 2. If chapter already has pages, return them directly from DB!
  if (currentChapter.pages && currentChapter.pages.length > 0) {
    console.log(`[Providers] Serving chapter pages for "${comic.title}" - "${currentChapter.title}" from database cache.`);
    const prevChapter = index > 0 ? chapters[index - 1] : undefined;
    const nextChapter = index !== -1 && index < chapters.length - 1 ? chapters[index + 1] : undefined;

    return {
      comic: toProviderSummary(comic),
      chapter: currentChapter,
      previousChapter: prevChapter ? {
        slug: prevChapter.slug,
        number: prevChapter.number,
        title: prevChapter.title,
        createdAt: prevChapter.createdAt
      } : undefined,
      nextChapter: nextChapter ? {
        slug: nextChapter.slug,
        number: nextChapter.number,
        title: nextChapter.title,
        createdAt: nextChapter.createdAt
      } : undefined
    };
  }

  // 3. Otherwise, fetch pages live from TruyenQQ mirror
  const baseUrl = await getTruyenQQBaseUrl();
  const url = `${baseUrl.replace(/\/$/, "")}/truyen-tranh/${chapterSlug}`;

  console.log(`[Providers] Fetching pages live from TruyenQQ for chapter: ${chapterSlug}`);
  const res = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "referer": baseUrl
    }
  });

  if (!res.ok) {
    throw new ProviderError(`Không tìm thấy chương từ TruyenQQ. HTTP ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  const pages: ComicPage[] = [];
  $(".page-chapter img, .chapter_content img").each((index, el) => {
    const src = $(el).attr("src") || $(el).attr("data-src") || $(el).attr("data-original") || "";
    const cleanedSrc = src.trim();
    if (cleanedSrc && !cleanedSrc.startsWith("data:image")) {
      pages.push({
        index: index + 1,
        image: `/api/proxy/image?url=${encodeURIComponent(cleanedSrc)}`
      });
    }
  });

  if (pages.length === 0) {
    throw new ProviderError("Không lấy được trang ảnh cho chương này.");
  }

  // 4. Update only this comic detail file.
  currentChapter.pages = pages;
  await writeComicDirect(comic);
  console.log(`[Providers] Saved fetched pages for "${comic.title}" - "${currentChapter.title}" to database.`);

  const prevChapter = index > 0 ? chapters[index - 1] : undefined;
  const nextChapter = index !== -1 && index < chapters.length - 1 ? chapters[index + 1] : undefined;

  return {
    comic: toProviderSummary(comic),
    chapter: {
      ...currentChapter,
      pages
    },
    previousChapter: prevChapter ? {
      slug: prevChapter.slug,
      number: prevChapter.number,
      title: prevChapter.title,
      createdAt: prevChapter.createdAt
    } : undefined,
    nextChapter: nextChapter ? {
      slug: nextChapter.slug,
      number: nextChapter.number,
      title: nextChapter.title,
      createdAt: nextChapter.createdAt
    } : undefined
  };
}
