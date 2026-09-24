import * as cheerio from "cheerio";
import crypto from "node:crypto";
import { comicToSummary, readComicBySlug, readComicIndex, writeComicDirect } from "./storage";
import type { Comic, ComicSummary, Chapter, ComicPage } from "./types";

const CHAPTER_SELECTORS = [
  '.works-chapter-list a', // TruyenQQ
  '.wp-manga-chapter a', // Madara theme (truyenggvn.com)
  '.chapter-name a',
  '.list-chapter a',
  '.chapter a',
  'tr.chapter a',
  '.list-chap a'
];

const IMAGE_SELECTORS = [
  '.page-chapter img', // TruyenQQ
  '.page-break img', // Madara theme (truyenggvn.com)
  '.reading-content img',
  '.page-reading img',
  '.reading-detail img',
  '#chapter-content img',
  '.chapter-content img',
  '.box-chap img'
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function envNumber(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function truyenQQDetailDelay() {
  const min = envNumber("TRUYENQQ_CRAWL_MIN_DELAY_MS", 1500);
  const max = Math.max(min, envNumber("TRUYENQQ_CRAWL_MAX_DELAY_MS", 2500));
  return min + Math.random() * (max - min);
}

type TruyenQQSyncOptions = {
  startPage?: number;
  skipHot?: boolean;
};

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

export async function fetchHtml(url: string): Promise<string> {
  let targetUrl = url;
  if (url.includes("flax.to")) {
    const activeDomain = await resolveTruyenQQDomain();
    targetUrl = url.replace(/https?:\/\/[^\/]+/, activeDomain);
    console.log(`[Sync] Rewrote flax.to URL: ${url} -> ${targetUrl}`);
  }
  const response = await fetch(targetUrl, {
    headers: {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
      "accept-language": "vi,en-US;q=0.9,en;q=0.8",
      "referer": new URL(targetUrl).origin
    }
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.text();
}

function parseChapterNumber(text: string, fallbackIndex: number): number {
  const cleanText = text.toLowerCase().replace(/đ/g, "d").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const match = cleanText.match(/(?:chuong|chap|chapter|tập|ep)\s*(\d+(?:\.\d+)?)/);
  if (match) {
    return parseFloat(match[1]);
  }
  const fallbackMatch = cleanText.match(/(\d+(?:\.\d+)?)/);
  if (fallbackMatch) {
    return parseFloat(fallbackMatch[1]);
  }
  return fallbackIndex + 1;
}

export async function fetchChapterPages(chapterUrl: string): Promise<ComicPage[]> {
  const html = await fetchHtml(chapterUrl);
  const $ = cheerio.load(html);
  const imagesFound: string[] = [];

  for (const selector of IMAGE_SELECTORS) {
    $(selector).each((_, el) => {
      const src = $(el).attr("data-src") || $(el).attr("data-lazy-src") || $(el).attr("data-original") || $(el).attr("src") || "";
      const cleanedSrc = src.trim();
      if (cleanedSrc && !cleanedSrc.startsWith("data:image")) {
        try {
          const resolvedSrc = new URL(cleanedSrc, chapterUrl).toString();
          imagesFound.push(resolvedSrc);
        } catch {
          imagesFound.push(cleanedSrc);
        }
      }
    });
    if (imagesFound.length > 0) break;
  }

  return imagesFound.map((imgUrl, index) => ({
    index: index + 1,
    image: imgUrl
  }));
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

function uniqueSlug(base: string, taken: Set<string>) {
  let candidate = base || "chuong";
  let index = 2;
  while (taken.has(candidate)) {
    candidate = `${base}-${index}`;
    index += 1;
  }
  return candidate;
}

export async function syncAllComics() {
  console.log(`[Sync] Starting auto-sync check at ${new Date().toISOString()}`);
  try {
    const comics = await readComicIndex();
    let updatedCount = 0;

    for (const summary of comics) {
      if (!summary.source || !summary.source.url) {
        continue;
      }
      const sourceUrl = summary.source.url.trim();
      if (!sourceUrl.startsWith("http")) {
        continue;
      }

      const comic = await readComicBySlug(summary.slug);
      if (!comic) {
        continue;
      }

      console.log(`[Sync] Checking "${comic.title}" from source: ${sourceUrl}`);
      try {
        const html = await fetchHtml(sourceUrl);
        const $ = cheerio.load(html);
        const chaptersFound: { title: string; url: string; number: number }[] = [];
        const seenUrls = new Set<string>();

        for (const selector of CHAPTER_SELECTORS) {
          $(selector).each((_, el) => {
            const href = $(el).attr("href");
            if (!href) return;
            try {
              const resolvedUrl = new URL(href, sourceUrl).toString();
              if (seenUrls.has(resolvedUrl)) return;
              seenUrls.add(resolvedUrl);

              const title = $(el).text().trim() || "Chương mới";
              const number = parseChapterNumber(title, chaptersFound.length);
              chaptersFound.push({ title, url: resolvedUrl, number });
            } catch {
              // Ignore invalid URLs
            }
          });
          if (chaptersFound.length > 0) break;
        }

        chaptersFound.sort((a, b) => a.number - b.number);

        if (chaptersFound.length === 0) {
          console.log(`[Sync] No chapters found at source for "${comic.title}". Skipping.`);
          continue;
        }

        // Anti-DDoS safety: If we already have at least the same number of chapters, skip crawl details
        if (chaptersFound.length <= comic.chapters.length) {
          console.log(`[Sync] "${comic.title}" is up to date (Local: ${comic.chapters.length}, Source: ${chaptersFound.length}). Skipping.`);
          continue;
        }

        console.log(`[Sync] "${comic.title}" has new chapters! Local: ${comic.chapters.length}, Source: ${chaptersFound.length}`);

        const localSlugs = new Set(comic.chapters.map(c => c.slug));
        const maxLocalNumber = comic.chapters.reduce((max, c) => Math.max(max, c.number), 0);
        
        // Find chapters that are not in database or have a number higher than max local number
        const newChaptersToCrawl = chaptersFound.filter(
          c => c.number > maxLocalNumber || !localSlugs.has(slugify(c.title))
        );

        if (newChaptersToCrawl.length === 0) {
          console.log(`[Sync] All chapters are already present. Skipping.`);
          continue;
        }

        console.log(`[Sync] Will crawl ${newChaptersToCrawl.length} new chapters for "${comic.title}"`);

        const addedChapters: Chapter[] = [];
        for (const chap of newChaptersToCrawl) {
          // Throttling delay to prevent rate limit/IP block
          await sleep(2500);
          console.log(`[Sync] Crawling chapter "${chap.title}" from URL: ${chap.url}`);
          try {
            const pages = await fetchChapterPages(chap.url);
            if (pages.length === 0) {
              console.warn(`[Sync] Warning: No pages found for chapter "${chap.title}"`);
              continue;
            }

            const cleanSlug = uniqueSlug(slugify(chap.title), new Set([
              ...comic.chapters.map(c => c.slug),
              ...addedChapters.map(c => c.slug)
            ]));

            addedChapters.push({
              id: crypto.randomUUID(),
              slug: cleanSlug,
              number: chap.number,
              title: chap.title,
              createdAt: new Date().toISOString(),
              pages
            });
          } catch (chapErr) {
            console.error(`[Sync] Error crawling chapter "${chap.title}":`, chapErr);
          }
        }

        if (addedChapters.length > 0) {
          comic.chapters.push(...addedChapters);
          comic.chapters.sort((a, b) => a.number - b.number);
          comic.updatedAt = new Date().toISOString();
          await writeComicDirect(comic);
          updatedCount++;
          console.log(`[Sync] Successfully added ${addedChapters.length} new chapters to "${comic.title}"`);
        }

        // Wait between checking different comics to protect IP
        await sleep(3000);
      } catch (err) {
        console.error(`[Sync] Error checking comic "${comic.title}":`, err);
      }
    }

    if (updatedCount > 0) {
      console.log(`[Sync] Saved ${updatedCount} updated comics.`);
    } else {
      console.log(`[Sync] No new updates were added.`);
    }
  } catch (err) {
    console.error(`[Sync] Critical error in syncAllComics:`, err);
  }
}

export function startAutoSync() {
  if (process.env.ENABLE_LOCAL_AUTO_SYNC !== "1") {
    console.log("[Sync] Local auto-sync disabled. Set ENABLE_LOCAL_AUTO_SYNC=1 to enable.");
    return;
  }
  // Run once immediately on startup (wait 10 seconds to allow standard Express boot)
  setTimeout(() => {
    syncAllComics().catch(err => console.error("Initial sync error:", err));
  }, 10000);

  // Then run every 1 hour (3600000 ms)
  setInterval(() => {
    syncAllComics().catch(err => console.error("Interval sync error:", err));
  }, 3600000);
}

export function startTruyenQQCompareAutoSync() {
  if (process.env.ENABLE_TRUYENQQ_COMPARE_SYNC !== "1") {
    console.log("[TruyenQQ Compare] Auto-sync disabled. Set ENABLE_TRUYENQQ_COMPARE_SYNC=1 to enable.");
    return;
  }
  // Run once at startup (after 30s delay so server is fully ready)
  setTimeout(() => {
    console.log("[TruyenQQ Compare] Auto-sync started — running initial comparison...");
    runTruyenQQCompareSync(5).catch(err => console.error("[TruyenQQ Compare] Initial run error:", err));
  }, 30000);

  // Then run every 24 hours at the same time each day
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  setInterval(() => {
    console.log("[TruyenQQ Compare] Daily auto-sync triggered.");
    runTruyenQQCompareSync(5).catch(err => console.error("[TruyenQQ Compare] Daily run error:", err));
  }, TWENTY_FOUR_HOURS);

  console.log("[TruyenQQ Compare] Auto-sync scheduler registered (every 24h, first run in 30s).");
}

export function startTruyenQQAutoSync() {
  if (process.env.ENABLE_TRUYENQQ_AUTO_SYNC === "0") {
    console.log("[TruyenQQ] Auto-sync disabled by ENABLE_TRUYENQQ_AUTO_SYNC=0.");
    return;
  }
  const initialPages = Number(process.env.TRUYENQQ_INITIAL_SYNC_PAGES || 2);
  const intervalPages = Number(process.env.TRUYENQQ_INTERVAL_SYNC_PAGES || 2);
  const intervalMs = Number(process.env.TRUYENQQ_AUTO_SYNC_INTERVAL_MS || 10 * 60 * 1000);
  const initialDelayMs = Number(process.env.TRUYENQQ_INITIAL_SYNC_DELAY_MS || 2 * 60 * 1000);

  // Run initial crawl after startup delay.
  setTimeout(() => {
    console.log(`[TruyenQQ] Initial auto-sync started (${initialPages} pages)...`);
    runTruyenQQSync(initialPages).catch(err => console.error("[TruyenQQ] Initial sync error:", err));
  }, initialDelayMs);

  // Crawl a small number of latest pages regularly to catch new updates.
  setInterval(() => {
    console.log(`[TruyenQQ] Interval auto-sync triggered (${intervalPages} pages).`);
    runTruyenQQSync(intervalPages).catch(err => console.error("[TruyenQQ] Interval sync error:", err));
  }, intervalMs);

  console.log(`[TruyenQQ] Auto-sync scheduler registered (first run in ${Math.round(initialDelayMs / 1000)}s, every ${Math.round(intervalMs / 60000)} minutes).`);
}

// ─────────────────────────────────────────────────────────────────────────────
// TruyenQQ vs OTruyen comparison
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs/promises";
import path from "node:path";
import { projectRoot } from "./storage";

const OTRUYEN_BASE = "https://otruyenapi.com/v1/api";
const QQ_SYNC_RESULT_FILE = path.join(projectRoot, "data", "truyenqq_compare_sync.json");

export type TruyenQQCompareResult = {
  lastRun: string;
  status: "running" | "completed" | "error";
  progress: string;
  results: TruyenQQCompareItem[];
};

export type TruyenQQCompareItem = {
  title: string;
  truyenqqSlug: string;
  truyenqqUrl: string;
  truyenqqChap: number;
  truyenqqUpdated: string;
  otruyenSlug: string | null;
  otruyenChap: number | null;
  diff: number; // positive = truyenqq is ahead, 0 = same, -1 = not matched
  matched: boolean;
};

export async function readQQSyncResults(): Promise<TruyenQQCompareResult | null> {
  try {
    const raw = await fs.readFile(QQ_SYNC_RESULT_FILE, "utf-8");
    return JSON.parse(raw) as TruyenQQCompareResult;
  } catch {
    return null;
  }
}

async function writeQQSyncResults(data: TruyenQQCompareResult): Promise<void> {
  await fs.mkdir(path.dirname(QQ_SYNC_RESULT_FILE), { recursive: true });
  await fs.writeFile(QQ_SYNC_RESULT_FILE, JSON.stringify(data, null, 2), "utf-8");
}

function normalizeTitleForMatch(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titlesMatch(a: string, b: string): boolean {
  const na = normalizeTitleForMatch(a);
  const nb = normalizeTitleForMatch(b);
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  return false;
}

// Scrape one page of truyenqq recently updated list for comparison
async function scrapeTruyenQQPageForCompare(page: number): Promise<{
  items: { title: string; slug: string; url: string; latestChap: number; updatedText: string }[];
  hasMore: boolean;
}> {
  try {
    const activeDomain = await resolveTruyenQQDomain();
    const listUrl = `${activeDomain}/truyen-moi-cap-nhat/trang-${page}.html`;
    const html = await fetchHtml(listUrl);
    const $ = cheerio.load(html);

    const items: { title: string; slug: string; url: string; latestChap: number; updatedText: string }[] = [];
    $(".list_grid_out ul li").each((_, el) => {
      const a = $(el).find(".book_avatar a").first();
      const href = a.attr("href") || "";
      if (!href) return;

      const slugMatch = href.match(/\/truyen-tranh\/([^/?#\s]+)/);
      const slug = slugMatch ? slugMatch[1] : href.split("/").pop() || "";
      if (!slug) return;

      const title = $(el).find(".book_info .book_name a").text().trim() || $(el).find(".book_avatar img").attr("alt") || "";
      const lastChapA = $(el).find(".last_chapter a").first();
      const lastChapText = lastChapA.text().trim();
      const latestChap = parseChapterNumber(lastChapText, 0);

      const fullUrl = href.startsWith("http") ? href : `${activeDomain}${href}`;
      items.push({ title, slug, url: fullUrl, latestChap, updatedText: "Vừa cập nhật" });
    });

    const hasMore = items.length >= 20;
    return { items, hasMore };
  } catch (err) {
    console.error("[Sync] Error scraping TruyenQQ page for comparison:", err);
    return { items: [], hasMore: false };
  }
}

// Fetch latest chapter count for a comic from OTruyen API by slug
async function getOTruyenChapCount(slug: string): Promise<{ slug: string; chap: number } | null> {
  try {
    const res = await fetch(`${OTRUYEN_BASE}/truyen-tranh/${encodeURIComponent(slug)}`, {
      headers: { accept: "application/json", "user-agent": "WebTruyen/0.1" }
    });
    if (!res.ok) return null;
    const data = await res.json() as any;
    const serverData = data?.data?.item?.chapters?.[0]?.server_data || [];
    if (serverData.length === 0) return null;
    const maxChap = Math.max(...serverData.map((c: any) => parseFloat(c.chapter_name || "0")).filter((n: number) => !isNaN(n)));
    return { slug, chap: maxChap };
  } catch {
    return null;
  }
}

// Search OTruyen for a title
async function searchOTruyen(title: string): Promise<{ slug: string; chap: number } | null> {
  try {
    await sleep(1500); // be gentle
    const res = await fetch(`${OTRUYEN_BASE}/tim-kiem?keyword=${encodeURIComponent(title)}&page=1`, {
      headers: { accept: "application/json", "user-agent": "WebTruyen/0.1" }
    });
    if (!res.ok) return null;
    const data = await res.json() as any;
    const items: any[] = data?.data?.items || [];
    for (const item of items.slice(0, 3)) {
      if (titlesMatch(item.name || "", title)) {
        const chapLatest = item.chaptersLatest?.[0];
        const chap = parseFloat(chapLatest?.chapter_name || "0") || 0;
        return { slug: item.slug || "", chap };
      }
    }
    return null;
  } catch {
    return null;
  }
}

let qqCompareRunning = false;

export async function runTruyenQQCompareSync(pagesCount = 5): Promise<void> {
  if (qqCompareRunning) {
    console.log("[TruyenQQ Compare] Sync already running, skipping.");
    return;
  }
  qqCompareRunning = true;

  await writeQQSyncResults({
    lastRun: new Date().toISOString(),
    status: "running",
    progress: "Đang bắt đầu crawl truyenqqko.com...",
    results: []
  });

  console.log(`[TruyenQQ Compare] Starting comparison sync (${pagesCount} pages)`);

  try {
    const allItems: { title: string; slug: string; url: string; latestChap: number; updatedText: string }[] = [];

    for (let page = 1; page <= pagesCount; page++) {
      console.log(`[TruyenQQ Compare] Scraping page ${page}/${pagesCount}...`);
      await writeQQSyncResults({
        lastRun: new Date().toISOString(),
        status: "running",
        progress: `Đang crawl trang ${page}/${pagesCount} từ TruyenQQ...`,
        results: []
      });

      const { items, hasMore } = await scrapeTruyenQQPageForCompare(page);

      if (items.length === 0) {
        console.log(`[TruyenQQ Compare] Page ${page} returned no items, stopping.`);
        break;
      }

      for (const item of items) {
        if (!allItems.some(i => i.slug === item.slug)) {
          allItems.push(item);
        }
      }

      if (!hasMore) break;
      await sleep(2000 + Math.random() * 1000);
    }

    console.log(`[TruyenQQ Compare] Found ${allItems.length} recently updated comics on TruyenQQ`);

    const results: TruyenQQCompareItem[] = [];
    let processed = 0;

    for (const item of allItems) {
      processed++;
      console.log(`[TruyenQQ Compare] Comparing ${processed}/${allItems.length}: "${item.title}"`);

      await writeQQSyncResults({
        lastRun: new Date().toISOString(),
        status: "running",
        progress: `Đang so sánh ${processed}/${allItems.length}: "${item.title}"`,
        results
      });

      let otruyenMatch: { slug: string; chap: number } | null = null;
      otruyenMatch = await getOTruyenChapCount(item.slug);

      if (!otruyenMatch) {
        await sleep(1500);
        otruyenMatch = await searchOTruyen(item.title);
      }

      if (otruyenMatch) {
        const diff = item.latestChap - otruyenMatch.chap;
        results.push({
          title: item.title,
          truyenqqSlug: item.slug,
          truyenqqUrl: item.url,
          truyenqqChap: item.latestChap,
          truyenqqUpdated: item.updatedText,
          otruyenSlug: otruyenMatch.slug,
          otruyenChap: otruyenMatch.chap,
          diff,
          matched: true
        });
      } else {
        results.push({
          title: item.title,
          truyenqqSlug: item.slug,
          truyenqqUrl: item.url,
          truyenqqChap: item.latestChap,
          truyenqqUpdated: item.updatedText,
          otruyenSlug: null,
          otruyenChap: null,
          diff: -1,
          matched: false
        });
      }

      await sleep(1800 + Math.random() * 800);
    }

    results.sort((a, b) => {
      if (a.diff > 0 && b.diff > 0) return b.diff - a.diff;
      if (a.diff > 0) return -1;
      if (b.diff > 0) return 1;
      return 0;
    });

    await writeQQSyncResults({
      lastRun: new Date().toISOString(),
      status: "completed",
      progress: `Hoàn tất! So sánh ${allItems.length} truyện từ TruyenQQ.`,
      results
    });

    console.log(`[TruyenQQ Compare] Sync completed. ${results.filter(r => r.diff > 0).length} comics behind on OTruyen.`);
  } catch (err) {
    console.error("[TruyenQQ Compare] Sync error:", err);
    await writeQQSyncResults({
      lastRun: new Date().toISOString(),
      status: "error",
      progress: `Lỗi: ${err instanceof Error ? err.message : String(err)}`,
      results: []
    });
  } finally {
    qqCompareRunning = false;
  }
}

// ── TruyenQQ Background Sync Crawler ───────────────────────────────

export let truyenQQSyncStatus = {
  isRunning: false,
  phase: "idle", // "hot", "updates", "idle"
  currentPage: 0,
  totalPages: 0,
  addedCount: 0,
  updatedCount: 0,
  currentComic: "",
  lastActiveTime: new Date().toISOString()
};

let truyenQQSyncRunning = false;

async function saveSyncedComic(comic: Comic, existingMap: Map<string, ComicSummary>) {
  await writeComicDirect(comic);
  existingMap.set(comic.slug, comicToSummary(comic));
}

function mergeCachedPages(nextChapters: Chapter[], existingComic: Comic) {
  const pagesBySlug = new Map(
    existingComic.chapters
      .filter((chapter) => Array.isArray(chapter.pages) && chapter.pages.length > 0)
      .map((chapter) => [chapter.slug, chapter.pages])
  );

  return nextChapters.map((chapter) => ({
    ...chapter,
    pages: pagesBySlug.get(chapter.slug) || chapter.pages
  }));
}

export async function runTruyenQQSync(pagesToCrawl = 5, options: TruyenQQSyncOptions = {}) {
  if (truyenQQSyncRunning) {
    console.log("[TruyenQQ Sync] Already running. Skipping.");
    return;
  }
  truyenQQSyncRunning = true;
  const startPage = Math.max(1, Math.floor(options.startPage || 1));
  const skipHot = options.skipHot === true || process.env.TRUYENQQ_SKIP_HOT === "1" || startPage > 1;
  console.log(`[TruyenQQ Sync] Starting auto-crawl for TruyenQQ (${pagesToCrawl} pages, from page ${startPage})...`);

  truyenQQSyncStatus.isRunning = true;
  truyenQQSyncStatus.phase = "starting";
  truyenQQSyncStatus.currentPage = 0;
  truyenQQSyncStatus.totalPages = pagesToCrawl;
  truyenQQSyncStatus.addedCount = 0;
  truyenQQSyncStatus.updatedCount = 0;
  truyenQQSyncStatus.currentComic = "Đang khởi tạo...";
  truyenQQSyncStatus.lastActiveTime = new Date().toISOString();

  try {
    const activeDomain = await resolveTruyenQQDomain();
    const comics = await readComicIndex();
    const existingMap = new Map(comics.map((c) => [c.slug, c]));

    let addedCount = 0;
    let updatedCount = 0;
    const baseTime = Date.now();

    // ── Phase 1: Crawl "Truyện Hay" (top views) — 3 pages ──
    // These become the "Hot" section with high view counts
    const HOT_PAGES = skipHot ? 0 : Math.min(3, Math.ceil(pagesToCrawl / 5));
    for (let page = 1; page <= HOT_PAGES; page++) {
      console.log(`[TruyenQQ Sync] [HOT] Scraping truyen-hay page ${page}/${HOT_PAGES}...`);
      const listUrl = `${activeDomain}/truyen-hay/trang-${page}.html`;
      let html = "";
      try { html = await fetchHtml(listUrl); } catch { continue; }
      const $ = cheerio.load(html);

      const items: { slug: string; title: string; url: string; lastChapText: string }[] = [];
      $(".list_grid_out ul li").each((_, el) => {
        const a = $(el).find(".book_avatar a").first();
        const href = a.attr("href") || "";
        if (!href) return;
        const slugMatch = href.match(/\/truyen-tranh\/([^/?#\s]+)/);
        const slug = slugMatch ? slugMatch[1] : href.split("/").pop() || "";
        if (!slug) return;
        const title = $(el).find(".book_info .book_name a").text().trim() || $(el).find(".book_avatar img").attr("alt") || "";
        const lastChapA = $(el).find(".last_chapter a").first();
        const lastChapText = lastChapA.text().trim();
        items.push({ slug, title, url: href, lastChapText });
      });

      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        truyenQQSyncStatus.phase = "hot";
        truyenQQSyncStatus.currentPage = page;
        truyenQQSyncStatus.currentComic = item.title;
        truyenQQSyncStatus.addedCount = addedCount;
        truyenQQSyncStatus.updatedCount = updatedCount;
        truyenQQSyncStatus.lastActiveTime = new Date().toISOString();
        // Hot comics get very high view counts so they appear at the top of rankings
        const hotViews = 1000000 - ((page - 1) * items.length + idx) * 5000;

        const existing = existingMap.get(item.slug);
        if (existing && existing.totalChapters > 0) {
          // Update views to reflect popularity
          if ((existing.views || 0) < hotViews) {
            const existingDetail = await readComicBySlug(item.slug);
            if (existingDetail) {
              existingDetail.views = hotViews;
              await saveSyncedComic(existingDetail, existingMap);
              updatedCount++;
            }
          }
          const lastLocalChap = existingMap.get(item.slug)?.latestChapter || existing.latestChapter;
          if (lastLocalChap) {
            const localNum = parseChapterNumber(lastLocalChap.title, 0);
            const remoteNum = parseChapterNumber(item.lastChapText, 0);
            if (lastLocalChap.title === item.lastChapText || (localNum > 0 && localNum === remoteNum)) {
              continue;
            }
          }
        }

        await sleep(truyenQQDetailDelay());
        try {
          const detailUrl = item.url.startsWith("http") ? item.url : `${activeDomain}${item.url}`;
          const detailHtml = await fetchHtml(detailUrl);
          const detail$ = cheerio.load(detailHtml);
          const title = detail$(".book_detail h1, .info-item h1, .book_info h1, h1").first().text().trim() || item.title;
          const coverUrl = detail$(".book_avatar img").attr("src") || "";
          const cover = coverUrl ? `/api/proxy/image?url=${encodeURIComponent(coverUrl)}` : "/sample/covers/sky-market.svg";
          const description = detail$(".detail-content, .excerpt").first().text().trim() || "Chưa có mô tả.";
          let author = "Đang cập nhật";
          detail$(".info-detail .row, .book_info .row, .info-item, .book_info p, .book_info li, .info-detail li, .info-detail p").each((_, el) => {
            const name = detail$(el).find(".name").text().trim();
            if (name.includes("Tác giả")) { author = detail$(el).find(".col-xs-9").text().trim() || author; }
            else {
              const text = detail$(el).text();
              if (text.includes("Tác giả") && !text.includes("Nhóm dịch")) {
                const possible = text.split("Tác giả")[1]?.replace(":", "").trim();
                if (possible) author = possible;
              }
            }
          });
          const genres: string[] = [];
          detail$("li.li03 a[href*='/the-loai/'], .list-tags p, .list-tags a, .genres a").each((_, el) => { genres.push(detail$(el).text().trim()); });
          const virtualTime = new Date(baseTime + 86400000).toISOString(); // future time = shows as very recent
          const chapters: Chapter[] = [];
          detail$(".works-chapter-list a, .list-chapters a").each((cIndex, el) => {
            const href = detail$(el).attr("href") || "";
            const cTitle = detail$(el).text().trim() || `Chương ${cIndex + 1}`;
            if (!href || href.includes("-chap-0") || cTitle.includes("Đọc từ đầu") || cTitle.includes("Đọc mới nhất")) return;
            const cSlugMatch = href.match(/\/truyen-tranh\/([^/?#\s]+)/);
            const cSlug = cSlugMatch ? cSlugMatch[1] : href.split("/").pop() || "";
            if (!cSlug) return;
            const numberMatch = cTitle.match(/\d+(\.\d+)?/);
            const number = numberMatch ? parseFloat(numberMatch[0]) : cIndex + 1;
            chapters.push({ id: cSlug, slug: cSlug, number, title: cTitle, createdAt: virtualTime, pages: [] });
          });
          chapters.reverse();

          const existingComic = existingMap.get(item.slug);
          if (existingComic) {
            const existingDetail = await readComicBySlug(item.slug);
            if (existingDetail) {
              existingDetail.title = title;
              existingDetail.cover = cover;
              existingDetail.chapters = mergeCachedPages(chapters, existingDetail);
              existingDetail.views = hotViews;
              existingDetail.updatedAt = virtualTime;
              await saveSyncedComic(existingDetail, existingMap);
              updatedCount++;
            }
          } else {
            const newComic: Comic = {
              id: item.slug, slug: item.slug, title, altTitles: [], author, description,
              status: "ongoing", genres, cover, rating: 0, views: hotViews,
              createdAt: virtualTime, updatedAt: virtualTime,
              source: { name: "TruyenQQ", url: detailUrl, license: "Crawl" },
              chapters
            };
            await saveSyncedComic(newComic, existingMap);
            addedCount++;
            console.log(`[TruyenQQ Sync] [HOT] Added: "${title}" (${chapters.length} chaps, views: ${hotViews})`);
          }
        } catch (err) { console.error(`[TruyenQQ Sync] [HOT] Error:`, err); }
      }
      console.log(`[TruyenQQ Sync] [HOT] Page ${page}/${HOT_PAGES} processed.`);
    }

    // ── Phase 2: Crawl "Mới cập nhật" pages ──
    for (let page = startPage; page <= pagesToCrawl; page++) {
      console.log(`[TruyenQQ Sync] Scraping page ${page}/${pagesToCrawl}...`);
      const listUrl = `${activeDomain}/truyen-moi-cap-nhat/trang-${page}.html`;
      const html = await fetchHtml(listUrl);
      const $ = cheerio.load(html);

      // Get total pages count from pagination element
      if (page === 1) {
        try {
          const lastPageHref = $(".page_redirect a").last().attr("href");
          if (lastPageHref) {
            const match = lastPageHref.match(/trang-(\d+)(?:\.html)?/);
            if (match) {
              const parsedTotal = parseInt(match[1]);
              if (parsedTotal > 0) {
                if (pagesToCrawl >= 100) {
                  pagesToCrawl = parsedTotal;
                }
                truyenQQSyncStatus.totalPages = pagesToCrawl;
              }
            }
          }
        } catch (e) {
          console.error("[TruyenQQ Sync] Error parsing total pages from pagination:", e);
        }
      }

      const items: { slug: string; title: string; url: string; lastChapText: string }[] = [];
      $(".list_grid_out ul li").each((_, el) => {
        const a = $(el).find(".book_avatar a").first();
        const href = a.attr("href") || "";
        if (!href) return;

        const slugMatch = href.match(/\/truyen-tranh\/([^/?#\s]+)/);
        const slug = slugMatch ? slugMatch[1] : href.split("/").pop() || "";
        if (!slug) return;

        const title = $(el).find(".book_info .book_name a").text().trim() || $(el).find(".book_avatar img").attr("alt") || "";
        const lastChapA = $(el).find(".last_chapter a").first();
        const lastChapText = lastChapA.text().trim();

        items.push({ slug, title, url: href, lastChapText });
      });

      for (let index = 0; index < items.length; index++) {
        const item = items[index];
        truyenQQSyncStatus.phase = "updates";
        truyenQQSyncStatus.currentPage = page;
        truyenQQSyncStatus.currentComic = item.title;
        truyenQQSyncStatus.addedCount = addedCount;
        truyenQQSyncStatus.updatedCount = updatedCount;
        truyenQQSyncStatus.lastActiveTime = new Date().toISOString();
        const virtualTime = new Date(baseTime - ((page - 1) * items.length + index) * 60 * 1000).toISOString();

        const existing = existingMap.get(item.slug);
        if (existing && existing.totalChapters > 0) {
          const lastLocalChap = existing.latestChapter;
          if (lastLocalChap) {
            const localNum = parseChapterNumber(lastLocalChap.title, 0);
            const remoteNum = parseChapterNumber(item.lastChapText, 0);

            if (lastLocalChap.title === item.lastChapText || (localNum > 0 && localNum === remoteNum)) {
              // Comic is already up to date, skip detail fetch but update sort order if changed.
              if (existing.updatedAt !== virtualTime) {
                const existingDetail = await readComicBySlug(item.slug);
                if (existingDetail) {
                  existingDetail.updatedAt = virtualTime;
                  await saveSyncedComic(existingDetail, existingMap);
                  updatedCount++;
                }
              }
              continue;
            }
          }
        }

        // Polite delay to prevent rate limits. Defaults to 1.5-2.5s, configurable for one-off local crawls.
        await sleep(truyenQQDetailDelay());

        try {
          const detailUrl = item.url.startsWith("http") ? item.url : `${activeDomain}${item.url}`;
          const detailHtml = await fetchHtml(detailUrl);
          const detail$ = cheerio.load(detailHtml);

          const title = detail$(".book_detail h1, .info-item h1, .book_info h1, h1").first().text().trim() || item.title;
          const coverUrl = detail$(".book_avatar img").attr("src") || "";
          const cover = coverUrl ? `/api/proxy/image?url=${encodeURIComponent(coverUrl)}` : "/sample/covers/sky-market.svg";
          const description = detail$(".detail-content, .excerpt").first().text().trim() || "Chưa có mô tả.";

          let author = "Đang cập nhật";
          detail$(".info-detail .row, .book_info .row, .info-item, .book_info p, .book_info li, .info-detail li, .info-detail p").each((_, el) => {
            const name = detail$(el).find(".name").text().trim();
            if (name.includes("Tác giả")) {
              author = detail$(el).find(".col-xs-9").text().trim() || author;
            } else {
              const text = detail$(el).text();
              if (text.includes("Tác giả") && !text.includes("Nhóm dịch")) {
                const parts = text.split("Tác giả");
                const possible = parts[1]?.replace(":", "").trim();
                if (possible) author = possible;
              }
            }
          });

          const genres: string[] = [];
          detail$("li.li03 a[href*='/the-loai/'], .list-tags p, .list-tags a, .genres a").each((_, el) => {
            genres.push(detail$(el).text().trim());
          });

          const chapters: Chapter[] = [];
          detail$(".works-chapter-list a, .list-chapters a").each((cIndex, el) => {
            const href = detail$(el).attr("href") || "";
            const cTitle = detail$(el).text().trim() || `Chương ${cIndex + 1}`;
            if (!href || href.includes("-chap-0") || cTitle.includes("Đọc từ đầu") || cTitle.includes("Đọc mới nhất")) {
              return;
            }

            const cSlugMatch = href.match(/\/truyen-tranh\/([^/?#\s]+)/);
            const cSlug = cSlugMatch ? cSlugMatch[1] : href.split("/").pop() || "";
            if (!cSlug) return;

            const numberMatch = cTitle.match(/\d+(\.\d+)?/);
            const number = numberMatch ? parseFloat(numberMatch[0]) : cIndex + 1;

            chapters.push({
              id: cSlug,
              slug: cSlug,
              number,
              title: cTitle,
              createdAt: virtualTime,
              pages: []
            });
          });

          chapters.reverse();

          const existingComic = existingMap.get(item.slug);
          if (existingComic) {
            const existingDetail = await readComicBySlug(item.slug);
            if (existingDetail) {
              existingDetail.title = title;
              existingDetail.author = author;
              existingDetail.cover = cover;
              existingDetail.description = description;
              existingDetail.genres = genres;
              existingDetail.chapters = mergeCachedPages(chapters, existingDetail);
              existingDetail.updatedAt = virtualTime;
              await saveSyncedComic(existingDetail, existingMap);
              updatedCount++;
              console.log(`[TruyenQQ Sync] Updated: "${title}" (${chapters.length} chaps)`);
            }
          } else {
            const newComic: Comic = {
              id: item.slug,
              slug: item.slug,
              title,
              altTitles: [],
              author,
              description,
              status: "ongoing",
              genres,
              cover,
              rating: 0,
              views: 0,
              createdAt: virtualTime,
              updatedAt: virtualTime,
              source: {
                name: "TruyenQQ",
                url: detailUrl,
                license: "Crawl"
              },
              chapters
            };
            await saveSyncedComic(newComic, existingMap);
            addedCount++;
            console.log(`[TruyenQQ Sync] Added: "${title}" (${chapters.length} chaps)`);
          }
        } catch (detailErr) {
          console.error(`[TruyenQQ Sync] Error crawling detail for ${item.title}:`, detailErr);
        }
      }
      console.log(`[TruyenQQ Sync] Page ${page}/${pagesToCrawl} processed.`);
    }
    console.log(`[TruyenQQ Sync] Done! Added ${addedCount} new, updated ${updatedCount} comics.`);
  } catch (err) {
    console.error("[TruyenQQ Sync] Main sync loop error:", err);
  } finally {
    truyenQQSyncRunning = false;
    truyenQQSyncStatus.isRunning = false;
    truyenQQSyncStatus.phase = "idle";
    truyenQQSyncStatus.currentComic = "";
    truyenQQSyncStatus.lastActiveTime = new Date().toISOString();
  }
}

let cachedTotalPages = 0;
let lastTotalPagesFetch = 0;

export async function getTruyenQQTotalPagesEstimate(): Promise<number> {
  const now = Date.now();
  if (cachedTotalPages > 0 && now - lastTotalPagesFetch < 3600000) {
    return cachedTotalPages;
  }
  try {
    const activeDomain = await resolveTruyenQQDomain();
    const listUrl = `${activeDomain}/truyen-moi-cap-nhat/trang-1.html`;
    const html = await fetchHtml(listUrl);
    const $ = cheerio.load(html);
    const lastPageHref = $(".page_redirect a").last().attr("href");
    if (lastPageHref) {
      const match = lastPageHref.match(/trang-(\d+)(?:\.html)?/);
      if (match) {
        const parsedTotal = parseInt(match[1]);
        if (parsedTotal > 0) {
          cachedTotalPages = parsedTotal;
          lastTotalPagesFetch = now;
          return cachedTotalPages;
        }
      }
    }
  } catch (err) {
    console.error("[Sync] Error estimating TruyenQQ total pages:", err);
  }
  if (cachedTotalPages > 0) return cachedTotalPages;
  return 120; // safe fallback (approx 4300 comics)
}
