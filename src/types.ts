export type ComicStatus = "ongoing" | "completed" | "paused";

export type ComicPage = {
  index: number;
  image: string;
  width?: number;
  height?: number;
};

export type Chapter = {
  id: string;
  slug: string;
  number: number;
  title: string;
  createdAt: string;
  pages: ComicPage[];
};

export type Comic = {
  id: string;
  slug: string;
  title: string;
  altTitles?: string[];
  author: string;
  artist?: string;
  description: string;
  status: ComicStatus;
  genres: string[];
  cover: string;
  rating: number;
  views: number;
  createdAt: string;
  updatedAt: string;
  source?: {
    name?: string;
    url?: string;
    license?: string;
  };
  chapters: Chapter[];
};

export type ComicSummary = Omit<Comic, "chapters"> & {
  totalChapters: number;
  latestChapter?: Pick<Chapter, "slug" | "number" | "title" | "createdAt">;
};

export type ReaderPayload = {
  comic: ComicSummary;
  chapter: Chapter;
  previousChapter?: Pick<Chapter, "slug" | "number" | "title" | "createdAt">;
  nextChapter?: Pick<Chapter, "slug" | "number" | "title" | "createdAt">;
};

export type MetaPayload = {
  genres: string[];
  statuses: Array<{ value: ComicStatus; label: string }>;
};

export type OTruyenMetaPayload = {
  genres: Array<{ name: string; slug: string }>;
  statuses: Array<{ value: string; label: string }>;
};

export type PaginatedPayload<T> = {
  items: T[];
  pagination: {
    totalItems: number;
    totalItemsPerPage: number;
    currentPage: number;
    totalPages: number;
  };
};

export type MovieSummary = {
  id: string;
  slug: string;
  title: string;
  originTitle: string;
  poster: string;
  thumb: string;
  year?: number;
  rating: number;
  type?: string;
  updatedAt?: string;
};

export type MovieEpisode = {
  name: string;
  slug: string;
  filename: string;
  embedUrl?: string;
  streamUrl?: string;
};

export type MovieServer = {
  serverName: string;
  episodes: MovieEpisode[];
};

export type MovieDetail = MovieSummary & {
  description: string;
  status?: string;
  quality?: string;
  language?: string;
  episodeCurrent?: string;
  episodeTotal?: string;
  duration?: string;
  trailerUrl?: string;
  categories: string[];
  countries: string[];
  actors: string[];
  directors: string[];
  episodes: MovieServer[];
};

export type Route =
  | { name: "catalog" }
  | { name: "comicApi"; slug: string }
  | { name: "comic"; slug: string }
  | { name: "comicQQ"; slug: string }
  | { name: "readerApi"; comicSlug: string; chapterSlug: string }
  | { name: "reader"; comicSlug: string; chapterSlug: string }
  | { name: "readerQQ"; comicSlug: string; chapterSlug: string }
  | { name: "importer" }
  | { name: "account"; tab: "profile" | "favorites" | "history" }
  | { name: "adminPage" }
  | { name: "movies" }
  | { name: "movie"; slug: string; episodeSlug?: string }
  | { name: "uiPreview" };

export type ReaderTheme = "light" | "dark" | "sepia";
export type CatalogSource = "otruyen" | "local" | "truyenqq";
export type ComicRankingMode = "day" | "week" | "month";

export type LastRead = {
  chapterSlug: string;
  chapterTitle: string;
  updatedAt: string;
};

export type AvatarFrameReward = {
  id: string;
  label: string;
  unlockLevel: number;
  adminOnly?: boolean;
  image?: string;
  video?: string;
  cssClass?: string;
};

export type ReaderLevelInfo = {
  index: number;
  label: string;
  nextLabel: string;
  xp: number;
  currentXp: number;
  nextXp: number;
  progress: number;
  isMax: boolean;
};

export type ComicComment = {
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

export type FavoriteMovie = {
  slug: string;
  title: string;
  poster: string;
};

export type WatchHistoryItem = {
  slug: string;
  title: string;
  poster: string;
  episodeSlug: string;
  episodeName: string;
  watchedAt: string;
};

export type AuthUser = {
  id: string;
  username: string;
  displayName?: string;
  avatar?: string;
  avatarFrame?: string;
  createdAt: string;
  favorites?: FavoriteMovie[];
  favoriteActors?: string[];
  watchHistory?: WatchHistoryItem[];
  comicFollows?: Array<{ slug: string; source: string; title: string; cover: string; followedAt?: string }>;
  comicHistory?: Array<{ slug: string; source: string; title: string; cover: string; chapterSlug: string; chapterTitle: string; updatedAt: string }>;
  role?: "admin" | "user";
};

export type DisplayComment = {
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

export type ReplyTarget = {
  parentId: string;
  replyTo: string;
};
