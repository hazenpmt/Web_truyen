import { getTruyenQQTotalPagesEstimate, runTruyenQQSync } from "../server/sync";

type CrawlCliOptions = {
  pagesArg: number | "all";
  startPage: number;
  fast: boolean;
  skipHot: boolean;
};

function parsePagesArg(value: string | undefined) {
  const raw = (value || "all").trim().toLowerCase();
  if (raw === "all" || raw === "--all") return "all" as const;
  const pages = Number(raw);
  if (!Number.isFinite(pages) || pages < 1) {
    throw new Error("Pages must be a positive number, or use \"all\".");
  }
  return Math.floor(pages);
}

function parseCliOptions(args: string[]): CrawlCliOptions {
  let pageToken = "all";
  let startPage = 1;
  let fast = false;
  let skipHot = false;

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--fast") {
      fast = true;
      continue;
    }
    if (arg === "--skip-hot") {
      skipHot = true;
      continue;
    }
    if (arg === "--from" || arg === "--start-page") {
      startPage = Number(args[++index] || 1);
      continue;
    }
    if (arg.startsWith("--from=")) {
      startPage = Number(arg.slice("--from=".length));
      continue;
    }
    if (arg.startsWith("--start-page=")) {
      startPage = Number(arg.slice("--start-page=".length));
      continue;
    }
    if (!arg.startsWith("--")) {
      pageToken = arg;
    }
  }

  if (!Number.isFinite(startPage) || startPage < 1) {
    throw new Error("Start page must be a positive number.");
  }

  return {
    pagesArg: parsePagesArg(pageToken),
    startPage: Math.floor(startPage),
    fast,
    skipHot
  };
}

async function main() {
  const { pagesArg, startPage, fast, skipHot } = parseCliOptions(process.argv.slice(2));
  if (fast) {
    process.env.TRUYENQQ_CRAWL_MIN_DELAY_MS ||= "600";
    process.env.TRUYENQQ_CRAWL_MAX_DELAY_MS ||= "1000";
  }

  const pages = pagesArg === "all" ? await getTruyenQQTotalPagesEstimate() : pagesArg;

  console.log(`[TruyenQQ CLI] Starting ${pagesArg === "all" ? "full" : "partial"} crawl (${pages} pages, from page ${startPage}).`);
  if (fast) {
    console.log(`[TruyenQQ CLI] Fast mode enabled (${process.env.TRUYENQQ_CRAWL_MIN_DELAY_MS}-${process.env.TRUYENQQ_CRAWL_MAX_DELAY_MS}ms delay per detail fetch).`);
  }
  console.log("[TruyenQQ CLI] This crawls comic metadata and chapter lists. Chapter images are cached when readers open chapters.");

  await runTruyenQQSync(pages, { startPage, skipHot });

  console.log("[TruyenQQ CLI] Crawl finished.");
}

main().catch((error) => {
  console.error("[TruyenQQ CLI] Crawl failed:", error);
  process.exitCode = 1;
});
