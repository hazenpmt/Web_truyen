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
