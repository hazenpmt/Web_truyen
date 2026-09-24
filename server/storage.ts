import { access, mkdir, readFile, writeFile, rename, unlink } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Chapter, Comic, ComicSummary } from "./types";

const serverDir = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(serverDir, "..");
export const dataDir = path.join(projectRoot, "data");
export const uploadsDir = path.join(projectRoot, "public", "uploads");
const comicsIndexFile = path.join(dataDir, "comics_index.json");
const comicsDir = path.join(dataDir, "comics");
const detailCacheLimit = 50;
let storageReady = false;

export async function ensureStorage() {
  if (storageReady) return;
  await mkdir(dataDir, { recursive: true });
  await mkdir(uploadsDir, { recursive: true });
  await mkdir(comicsDir, { recursive: true });
  try {
    await access(comicsIndexFile);
  } catch {
    await writeJsonAtomic(comicsIndexFile, []);
  }
  storageReady = true;
}

let cachedComicIndex: ComicSummary[] | null = null;
const cachedComicDetails = new Map<string, Comic>();

export async function readComicIndex(): Promise<ComicSummary[]> {
  await ensureStorage();
  if (cachedComicIndex !== null) {
    return cachedComicIndex;
  }
  const content = await readFile(comicsIndexFile, "utf8");
  cachedComicIndex = JSON.parse(content) as ComicSummary[];
  return cachedComicIndex;
}

export async function readComicBySlug(slug: string): Promise<Comic | undefined> {
  await ensureStorage();
  const cached = cachedComicDetails.get(slug);
  if (cached) {
    cachedComicDetails.delete(slug);
    cachedComicDetails.set(slug, cached);
    return cached;
  }

  try {
    const content = await readFile(comicDetailPath(slug), "utf8");
    const comic = normalizeComic(JSON.parse(content) as Comic);
    cacheComicDetail(comic);
    return comic;
  } catch {
    return undefined;
  }
}

export async function readComics(): Promise<Comic[]> {
  const index = await readComicIndex();
  const comics: Comic[] = [];
  for (const item of index) {
    const comic = await readComicBySlug(item.slug);
    if (comic) comics.push(comic);
  }
  return comics;
}

export async function writeComicDirect(comic: Comic) {
  await ensureStorage();
  const normalized = normalizeComic(comic);
  await writeJsonAtomic(comicDetailPath(normalized.slug), normalized);
  cacheComicDetail(normalized);

  const index = await readComicIndex();
  const summary = comicToSummary(normalized);
  const existingIndex = index.findIndex((item) => item.slug === summary.slug);
  if (existingIndex >= 0) {
    index[existingIndex] = summary;
  } else {
    index.unshift(summary);
  }
  cachedComicIndex = index;
  await writeComicIndex(index);
}

export async function writeComics(comics: Comic[]) {
  await ensureStorage();
  const index: ComicSummary[] = [];
  cachedComicDetails.clear();
  for (const comic of comics) {
    const normalized = normalizeComic(comic);
    await writeJsonAtomic(comicDetailPath(normalized.slug), normalized);
    cacheComicDetail(normalized);
    index.push(comicToSummary(normalized));
  }
  cachedComicIndex = index;
  await writeComicIndex(index);
}

export async function deleteComicBySlug(slug: string): Promise<boolean> {
  await ensureStorage();
  const index = await readComicIndex();
  const nextIndex = index.filter((item) => item.slug !== slug);
  if (nextIndex.length === index.length) {
    return false;
  }

  cachedComicIndex = nextIndex;
  cachedComicDetails.delete(slug);
  await writeComicIndex(nextIndex);
  try {
    await unlink(comicDetailPath(slug));
  } catch {
    // The index is the source of truth for listing; a missing detail file is already deleted.
  }
  return true;
}

export function comicToSummary(comic: Comic): ComicSummary {
  const chapters = sortedChapters(comic.chapters);
  const latestChapter = chapters.at(-1);
  const { chapters: _chapters, ...summary } = comic;
  return {
    ...summary,
    description: excerpt(summary.description),
    totalChapters: chapters.length,
    latestChapter: latestChapter ? chapterLink(latestChapter) : undefined
  };
}

async function writeComicIndex(index: ComicSummary[]) {
  index.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  await writeJsonAtomic(comicsIndexFile, index);
}

async function writeJsonAtomic(filePath: string, data: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempFile = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempFile, `${JSON.stringify(data)}\n`, "utf8");
  await rename(tempFile, filePath);
}

function normalizeComic(comic: Comic): Comic {
  return {
    ...comic,
    chapters: sortedChapters(comic.chapters).map((chapter) => ({
      ...chapter,
      pages: Array.isArray(chapter.pages) ? chapter.pages : []
    }))
  };
}

function sortedChapters(chapters: Chapter[] = []) {
  return [...chapters].sort((a, b) => a.number - b.number);
}

function chapterLink(chapter: Chapter) {
  return {
    slug: chapter.slug,
    number: chapter.number,
    title: chapter.title,
    createdAt: chapter.createdAt
  };
}

function excerpt(value: string, maxLength = 260) {
  const clean = (value || "").replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean || "Chưa có mô tả.";
  return `${clean.slice(0, maxLength - 1).trimEnd()}...`;
}

function comicDetailPath(slug: string) {
  return path.join(comicsDir, `${createHash("sha1").update(slug).digest("hex")}.json`);
}

function cacheComicDetail(comic: Comic) {
  cachedComicDetails.set(comic.slug, comic);
  while (cachedComicDetails.size > detailCacheLimit) {
    const oldest = cachedComicDetails.keys().next().value;
    if (!oldest) break;
    cachedComicDetails.delete(oldest);
  }
}
