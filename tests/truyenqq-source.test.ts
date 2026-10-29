import assert from "node:assert/strict";
import { test } from "node:test";
import { truyenQQOrigin, resolveLegacyTruyenQQUrl } from "../server/truyenqq-source";

test("source configuration cannot resolve to the dead shortener", () => {
  assert.equal(truyenQQOrigin("https://truyenqqko.com/path"), "https://truyenqqko.com");
  assert.throws(() => truyenQQOrigin("https://flax.to/truyenqq"), /real comic website/);
  assert.throws(() => truyenQQOrigin("https://www.flax.to/"), /real comic website/);
  assert.throws(() => truyenQQOrigin("file:///tmp/source"), /real comic website/);
});

test("legacy shortener URLs are repaired without changing unrelated URLs", () => {
  const before = process.env.TRUYENQQ_BASE_URL;
  process.env.TRUYENQQ_BASE_URL = "https://configured.example";
  try {
    assert.equal(resolveLegacyTruyenQQUrl("https://flax.to/truyen-moi-cap-nhat/trang-1.html?page=2"),
      "https://configured.example/truyen-moi-cap-nhat/trang-1.html?page=2");
    assert.equal(resolveLegacyTruyenQQUrl("https://other.example/chapter?ref=flax.to"),
      "https://other.example/chapter?ref=flax.to");
  } finally {
    if (before === undefined) delete process.env.TRUYENQQ_BASE_URL;
    else process.env.TRUYENQQ_BASE_URL = before;
  }
});
