import type { CatalogSource, Route } from "../types";

export function readStoredJson<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function lastReadKey(source: CatalogSource, slug: string): string {
  return `reader-last:${source}:${slug}`;
}

export function readChaptersKey(source: CatalogSource, slug: string): string {
  return `reader-read:${source}:${slug}`;
}

export function getReadChapterSet(source: CatalogSource, slug: string): Set<string> {
  return new Set(readStoredJson<string[]>(readChaptersKey(source, slug), []));
}

export function markChapterRead(source: CatalogSource, slug: string, chapterSlug: string): void {
  if (!chapterSlug) return;
  const key = readChaptersKey(source, slug);
  const current = readStoredJson<string[]>(key, []);
  if (current.includes(chapterSlug)) return;
  const next = [...current, chapterSlug];
  localStorage.setItem(key, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("reader-chapter-read", { detail: { source, slug } }));
}

export function followKey(source: CatalogSource, slug: string): string {
  return `comic-follow:${source}:${slug}`;
}

export function ratingKey(source: CatalogSource, slug: string): string {
  return `comic-rating:${source}:${slug}`;
}

export function commentsKey(source: CatalogSource, slug: string): string {
  return `comic-comments:${source}:${slug}`;
}

export function getStoredMode(): "movie" | "comic" {
  return localStorage.getItem("last_mode") === "movie" ? "movie" : "comic";
}

export function parseRoute(): Route {
  const parts = window.location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (!parts.length) {
    const lastMode = getStoredMode();
    if (lastMode === "movie") {
      window.location.hash = "/movies";
      return { name: "movies" };
    }
    return { name: "catalog" };
  }
  if (parts[0] === "import") return { name: "importer" };
  if (parts[0] === "admin") return { name: "adminPage" };
  if (parts[0] === "account") {
    const tab = parts[1] === "favorites" || parts[1] === "history" ? parts[1] : "profile";
    return { name: "account", tab };
  }
  if (parts[0] === "ui-preview") return { name: "uiPreview" };
  if (parts[0] === "movies") return { name: "movies" };
  if (parts[0] === "movie" && parts[1]) return { name: "movie", slug: parts[1], episodeSlug: parts[2] };
  if (parts[0] === "api-comic" && parts[1]) return { name: "comicApi", slug: parts[1] };
  if (parts[0] === "comic" && parts[1]) return { name: "comic", slug: parts[1] };
  if (parts[0] === "truyenqq-comic" && parts[1]) return { name: "comicQQ", slug: parts[1] };
  if (parts[0] === "api-read" && parts[1] && parts[2]) {
    return { name: "readerApi", comicSlug: parts[1], chapterSlug: parts[2] };
  }
  if (parts[0] === "read" && parts[1] && parts[2]) {
    return { name: "reader", comicSlug: parts[1], chapterSlug: parts[2] };
  }
  if (parts[0] === "truyenqq-read" && parts[1] && parts[2]) {
    return { name: "readerQQ", comicSlug: parts[1], chapterSlug: parts[2] };
  }
  return { name: "catalog" };
}

export function navigate(path: string): void {
  const cleanPath = path.replace(/^#?\/?/, "");
  if (cleanPath.startsWith("movies") || cleanPath.startsWith("movie")) {
    localStorage.setItem("last_mode", "movie");
  } else if (cleanPath === "" || cleanPath.startsWith("catalog") || cleanPath.startsWith("comic") || cleanPath.startsWith("read") || cleanPath.startsWith("api-comic") || cleanPath.startsWith("api-read") || cleanPath.startsWith("truyenqq-comic") || cleanPath.startsWith("truyenqq-read") || cleanPath.startsWith("import")) {
    localStorage.setItem("last_mode", "comic");
  }
  window.location.hash = path;
  window.scrollTo({ top: 0 });
}

export function comicPath(source: CatalogSource, slug: string): string {
  if (source === "otruyen") return `/api-comic/${slug}`;
  if (source === "truyenqq") return `/truyenqq-comic/${slug}`;
  return `/comic/${slug}`;
}

export function readPath(source: CatalogSource, comicSlug: string, chapterSlug: string): string {
  if (source === "otruyen") return `/api-read/${comicSlug}/${chapterSlug}`;
  if (source === "truyenqq") return `/truyenqq-read/${comicSlug}/${chapterSlug}`;
  return `/read/${comicSlug}/${chapterSlug}`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("vi-VN").format(value);
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

export function getGenreSlug(genreName: string, source: CatalogSource): string {
  if (source === "otruyen") {
    const mapping: Record<string, string> = {
      "Action": "action",
      "Manhwa": "manhwa",
      "Manhua": "manhua",
      "Manga": "manga",
      "Ngôn Tình": "ngon-tinh",
      "Truyện Màu": "truyen-mau",
      "Comedy": "comedy",
      "Fantasy": "fantasy"
    };
    return mapping[genreName] || genreName.toLowerCase();
  } else if (source === "truyenqq") {
    const mapping: Record<string, string> = {
      "Action": "action-26",
      "Manhwa": "manhwa-49",
      "Manhua": "manhua-35",
      "Manga": "manga-469",
      "Ngôn Tình": "ngon-tinh-87",
      "Truyện Màu": "truyen-mau-92",
      "Comedy": "comedy-28",
      "Fantasy": "fantasy-30",
      "Romance": "romance-36",
      "School Life": "school-life-37",
      "Slice Of Life": "slice-of-life-46",
      "Slice of life": "slice-of-life-46"
    };
    return mapping[genreName] || genreName.toLowerCase();
  }
  return genreName;
}
