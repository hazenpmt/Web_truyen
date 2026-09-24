import type {
  Comic,
  ComicSummary,
  MetaPayload,
  MovieDetail,
  MovieSummary,
  OTruyenMetaPayload,
  PaginatedPayload,
  ReaderPayload
} from "./types";

export type ChapterCommentPayload = {
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

type ComicFilters = {
  search?: string;
  genre?: string;
  status?: string;
  page?: number;
  limit?: number;
};

export async function fetchComics(filters: ComicFilters) {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.genre) params.set("genre", filters.genre);
  if (filters.status) params.set("status", filters.status);
  if (filters.page) params.set("page", String(filters.page));
  if (filters.limit) params.set("limit", String(filters.limit));
  const query = params.toString();
  return request<PaginatedPayload<ComicSummary>>(`/api/comics${query ? `?${query}` : ""}`);
}

export async function fetchMeta() {
  return request<MetaPayload>("/api/meta");
}

export async function fetchComic(slug: string) {
  return request<Comic>(`/api/comics/${slug}`);
}

export async function fetchChapter(comicSlug: string, chapterSlug: string) {
  return request<ReaderPayload>(`/api/comics/${comicSlug}/chapters/${chapterSlug}`);
}

export async function fetchOTruyenMeta() {
  return request<OTruyenMetaPayload>("/api/providers/comics/meta");
}

export async function fetchOTruyenComics(filters: { search?: string; category?: string; type?: string; page?: number }) {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.category) params.set("category", filters.category);
  if (filters.type) params.set("type", filters.type);
  if (filters.page) params.set("page", String(filters.page));
  return request<PaginatedPayload<ComicSummary>>(`/api/providers/comics?${params.toString()}`);
}

export async function fetchOTruyenComic(slug: string) {
  return request<Comic>(`/api/providers/comics/${slug}`);
}

export async function fetchOTruyenChapter(comicSlug: string, chapterSlug: string) {
  return request<ReaderPayload>(`/api/providers/comics/${comicSlug}/chapters/${chapterSlug}`);
}

export async function fetchTruyenQQMeta() {
  return request<OTruyenMetaPayload>("/api/providers/truyenqq/meta");
}

export async function fetchTruyenQQComics(filters: { search?: string; category?: string; page?: number; limit?: number }) {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.category) params.set("category", filters.category);
  if (filters.page) params.set("page", String(filters.page));
  if (filters.limit) params.set("limit", String(filters.limit));
  return request<PaginatedPayload<ComicSummary>>(`/api/providers/truyenqq?${params.toString()}`);
}

export async function fetchTruyenQQRanking(type: "day" | "week" | "month") {
  return request<{ items: ComicSummary[] }>(`/api/providers/truyenqq/ranking?type=${type}`);
}

export async function fetchTruyenQQComic(slug: string) {
  return request<Comic>(`/api/providers/truyenqq/${slug}`);
}

export async function fetchTruyenQQChapter(comicSlug: string, chapterSlug: string) {
  return request<ReaderPayload>(`/api/providers/truyenqq/${comicSlug}/chapters/${chapterSlug}`);
}

export async function fetchMovies(filters: { search?: string; type?: string; page?: number; limit?: number }) {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.type) params.set("type", filters.type);
  if (filters.page) params.set("page", String(filters.page));
  if (filters.limit) params.set("limit", String(filters.limit));
  return request<PaginatedPayload<MovieSummary>>(`/api/providers/movies?${params.toString()}`);
}

export async function fetchMovie(slug: string) {
  return request<MovieDetail>(`/api/providers/movies/${slug}`);
}

export async function importManifest(payload: { manifest?: unknown; manifestUrl?: string; confirmRights: boolean }) {
  return request<{ comic: ComicSummary }>("/api/import/manifest", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function fetchChapterComments(filters: { source: string; comicSlug: string; chapterSlug: string }) {
  const params = new URLSearchParams();
  params.set("source", filters.source);
  params.set("comicSlug", filters.comicSlug);
  params.set("chapterSlug", filters.chapterSlug);
  return request<{ comments: ChapterCommentPayload[] }>(`/api/comments/chapters?${params.toString()}`);
}

export async function postChapterComment(payload: {
  source: string;
  comicSlug: string;
  chapterSlug: string;
  name: string;
  text: string;
  sticker?: string;
  avatar?: string;
  avatarFrame?: string;
  parentId?: string;
  replyTo?: string;
}) {
  const token = localStorage.getItem("auth_token") || "";
  return request<{ comments: ChapterCommentPayload[] }>("/api/comments/chapters", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(payload)
  });
}


async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data.message === "string" ? data.message : "Request failed");
  }
  return data as T;
}
