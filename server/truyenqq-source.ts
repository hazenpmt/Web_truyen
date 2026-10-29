import "dotenv/config";

// The old flax.to/truyenqq short link now returns a 404 landing page.
// Keep the actual source configurable instead of accepting a shortener as a source.
export function truyenQQOrigin(value = process.env.TRUYENQQ_BASE_URL || "https://truyenqqko.com"): string {
  const url = new URL(value);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password ||
      url.hostname === "flax.to" || url.hostname.endsWith(".flax.to")) {
    throw new Error("TRUYENQQ_BASE_URL must be the real comic website, not a short link.");
  }
  return url.origin;
}

export function resolveLegacyTruyenQQUrl(value: string): string {
  const url = new URL(value);
  if (url.hostname === "flax.to" || url.hostname.endsWith(".flax.to")) {
    return `${truyenQQOrigin()}${url.pathname}${url.search}${url.hash}`;
  }
  return value;
}
