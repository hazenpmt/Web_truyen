import { mkdir, readFile, writeFile, rename, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data");
const legacyFile = path.join(dataDir, "comics.json");
const indexFile = path.join(dataDir, "comics_index.json");
const detailsDir = path.join(dataDir, "comics");

await mkdir(detailsDir, { recursive: true });

const legacyStat = await stat(legacyFile).catch(() => null);
if (!legacyStat || legacyStat.size <= 2) {
  console.log("No legacy data/comics.json data found. Writing an empty split index.");
  await writeJsonAtomic(indexFile, []);
  process.exit(0);
}

console.log(`Reading legacy comics.json (${Math.round(legacyStat.size / 1024 / 1024)} MB)...`);
const comics = JSON.parse(await readFile(legacyFile, "utf8"));
if (!Array.isArray(comics)) {
  throw new Error("data/comics.json must contain a JSON array.");
}

const index = [];
let chaptersCount = 0;
let pagesCount = 0;

for (let i = 0; i < comics.length; i += 1) {
  const comic = normalizeComic(comics[i]);
  chaptersCount += comic.chapters.length;
  for (const chapter of comic.chapters) {
    pagesCount += chapter.pages.length;
  }

  await writeJsonAtomic(comicPath(comic.slug), comic);
  index.push(toSummary(comic));

  if ((i + 1) % 250 === 0 || i + 1 === comics.length) {
    console.log(`Migrated ${i + 1}/${comics.length} comics...`);
  }
}

index.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
await writeJsonAtomic(indexFile, index);

console.log(
  `Done. Wrote ${index.length} comic detail files, ${chaptersCount} chapters, ${pagesCount} stored pages.`
);
console.log("Legacy data/comics.json was kept as a backup.");

function normalizeComic(comic) {
  return {
    ...comic,
    chapters: Array.isArray(comic.chapters)
      ? [...comic.chapters]
          .sort((a, b) => Number(a.number || 0) - Number(b.number || 0))
          .map((chapter) => ({
            ...chapter,
            pages: Array.isArray(chapter.pages) ? chapter.pages : []
          }))
      : []
  };
}

function toSummary(comic) {
  const latestChapter = comic.chapters.at(-1);
  const { chapters, ...summary } = comic;
  return {
    ...summary,
    description: excerpt(summary.description),
    totalChapters: chapters.length,
    latestChapter: latestChapter
      ? {
          slug: latestChapter.slug,
          number: latestChapter.number,
          title: latestChapter.title,
          createdAt: latestChapter.createdAt
        }
      : undefined
  };
}

function excerpt(value, maxLength = 260) {
  const clean = String(value || "").replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean || "Chưa có mô tả.";
  return `${clean.slice(0, maxLength - 1).trimEnd()}...`;
}

function comicPath(slug) {
  return path.join(detailsDir, `${createHash("sha1").update(String(slug)).digest("hex")}.json`);
}

async function writeJsonAtomic(filePath, data) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempFile = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempFile, `${JSON.stringify(data)}\n`, "utf8");
  await rename(tempFile, filePath);
}
