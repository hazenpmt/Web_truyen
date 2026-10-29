import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDb } from "./database";
import type { Chapter, Comic, ComicSummary } from "./types";

const serverDir = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(serverDir, "..");
export const dataDir = path.join(projectRoot, "data");
export const uploadsDir = path.join(projectRoot, "public", "uploads");
type ComicRecord = Omit<Comic, "chapters"> & { _id: string; totalChapters: number; latestChapter?: ComicSummary["latestChapter"] };
type ChapterRecord = Chapter & { comicSlug: string };

export async function ensureStorage() {
  await getDb();
  await mkdir(uploadsDir, { recursive: true });
}

export async function readComicIndex(): Promise<ComicSummary[]> {
  const db = await getDb();
  const rows = await db.collection<ComicRecord>("comics").find({}, { projection: { _id: 0 } }).sort({ updatedAt: -1 }).toArray();
  return rows as ComicSummary[];
}

export async function readComicBySlug(slug: string): Promise<Comic | undefined> {
  const db = await getDb();
  const row = await db.collection<ComicRecord>("comics").findOne({ _id: slug });
  if (!row) return undefined;
  const { _id, totalChapters, latestChapter, ...metadata } = row;
  const chapters = await db.collection<ChapterRecord>("chapters").find({ comicSlug: slug }, { projection: { _id: 0, comicSlug: 0 } }).sort({ number: 1 }).toArray();
  return { ...metadata, chapters } as Comic;
}

export async function readComics(): Promise<Comic[]> {
  const comics: Comic[] = [];
  for (const item of await readComicIndex()) {
    const comic = await readComicBySlug(item.slug);
    if (comic) comics.push(comic);
  }
  return comics;
}

export async function writeComicDirect(comic: Comic) {
  const db = await getDb();
  const normalized = normalizeComic(comic);
  const { chapters, ...metadata } = normalized;
  // Store each chapter separately; a long series must not become one huge document.
  for (let offset = 0; offset < chapters.length; offset += 250) {
    await db.collection<ChapterRecord>("chapters").bulkWrite(chapters.slice(offset, offset + 250).map((chapter) => ({
      replaceOne: {
        filter: { comicSlug: normalized.slug, slug: chapter.slug },
        replacement: { ...chapter, comicSlug: normalized.slug },
        upsert: true
      }
    })));
  }
  const summary = comicToSummary(normalized);
  await db.collection<ComicRecord>("comics").updateOne({ _id: normalized.slug }, { $set: {
    ...metadata, totalChapters: summary.totalChapters, latestChapter: summary.latestChapter
  } }, { upsert: true });
}

export async function writeComics(comics: Comic[]) {
  for (const comic of comics) await writeComicDirect(comic);
}

export async function deleteComicBySlug(slug: string): Promise<boolean> {
  const db = await getDb();
  const result = await db.collection<ComicRecord>("comics").deleteOne({ _id: slug });
  await db.collection("chapters").deleteMany({ comicSlug: slug });
  return result.deletedCount > 0;
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
