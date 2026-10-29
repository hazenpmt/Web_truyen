# MongoDB setup

The backend now requires MongoDB. It does not silently fall back to JSON if the database is unavailable.

## Local development

1. Use Node.js 22.12+ (or Node.js 24 LTS) and install dependencies with `npm ci`.
2. Copy `.env.example` to `.env`.
3. Set `MONGODB_URI` to your local MongoDB or Atlas connection string, and `MONGODB_DB` to your database name.
4. Generate a private JWT signing key with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` and set `JWT_SECRET`.
5. Run `npm run dev`.

Never commit `.env` or paste a connection string with credentials into chat. Atlas must allow the backend's outbound IP address and the database user must have read/write access to this database. See the [official MongoDB connection guide](https://www.mongodb.com/docs/drivers/node/current/get-started/).

Register an account, then grant it admin access from a trusted terminal:

```sh
npm run db:admin -- your_username
```

Registering the name `admin` no longer grants privileges. Existing admin roles are preserved during migration. Passwords are stored as hashes only.

## Render

Set `MONGODB_URI`, `MONGODB_DB`, and `JWT_SECRET` in the service's environment settings. Use `npm ci && npm run build` as the build command and `npm start` as the start command. Keep the URI on the backend; do not put it in a `VITE_*` variable.

Connect to the same database across redeployments to retain records. Uploaded files still require persistent disk or object storage. MongoDB does not store uploaded images or video bytes.

## Collections

| Collection | Contents |
| --- | --- |
| `comics` | Local/crawled comic metadata and summary; keyed by the existing slug |
| `chapters` | One document per comic/chapter, with image URLs |
| `users` | Account, bcrypt hash, favorites, bounded viewing/reading history and follows |
| `comments` | One document per chapter comment, grouped by source/comic/chapter |
| `provider_cache` | OTruyen and movie metadata, chapter image URLs and movie list responses |
| `app_state` | Bounded access log snapshot and crawler comparison results |

Provider cache is retained for seven days from the last successful fetch, then removed by a TTL index. This is a temporary cache, not a permanent content backup. The current frontend still keeps guest preferences, detail-page comic comments and ratings in localStorage. Chapter comments are shared through MongoDB.

MongoDB does not populate TruyenQQ automatically. Select OTruyen for live API content, or use the admin crawler / `npm run crawl:truyenqq -- 1` to populate the TruyenQQ catalog. Images and streams still depend on their original hosts.

## Import existing JSON

Back up the `data/` directory and MongoDB first. Stop the app and crawler, configure the target database, then run:

```sh
npm run migrate:mongodb
```

Run this where the old `data/` files exist. A fresh clone has no production data. The importer supports split `data/comics/*.json`, legacy `data/comics.json`, accounts, chapter comments, unexpired provider cache and app state. Split comic files take priority over the legacy monolithic file. Bundled demo comics are skipped. Existing database records take priority; JSON files remain untouched. If interrupted, rerun to continue importing missing records.

After validating migrated accounts, comics and histories, start the app. Changing `JWT_SECRET` invalidates old sessions and requires signing in again.

## Validation

`npm run check` checks TypeScript and builds the frontend. `npm run test:db` runs MongoDB integration tests against an isolated, temporary local MongoDB process. Its first run downloads a MongoDB test binary; it never uses your configured production URI.

Use `ENABLE_BACKGROUND_SYNC=0` to disable startup warmup and automatic crawlers, for example during verification. This does not disable manually triggered imports/crawls.

## TruyenQQ source

Set `TRUYENQQ_BASE_URL=https://truyenqqko.com` in the backend environment. Use the actual comic website origin when the source changes. The old `flax.to/truyenqq` link returns 404 and must not be used as the crawler origin. Both crawler and provider now share this setting.
