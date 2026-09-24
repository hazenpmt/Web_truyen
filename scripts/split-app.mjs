import fs from 'fs';
import path from 'path';

const fileContent = fs.readFileSync('src/App.tsx', 'utf8');
const lines = fileContent.split('\n');

function getBlock(start, end) {
  return lines.slice(start - 1, end).join('\n');
}

// 1. ComicDetail.tsx (lines 1972 to 2287)
const comicDetailBody = getBlock(1972, 2287);
const comicDetailHeader = `import { ArrowUp, BookOpen, Check, Eye, Heart, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  fetchComic,
  fetchComicComments,
  fetchOTruyenComic,
  fetchTruyenQQComic,
  fetchTruyenQQComments,
  postComicComment,
  postOTruyenComment,
  postTruyenQQComment
} from "../api";
import { OptimizedImage } from "../components/common/OptimizedImage";
import { Notice } from "../components/common/UIComponents";
import { QQCommentPanel } from "../components/comic/ComicComponents";
import type { CatalogSource, Comic, ComicComment, DisplayComment, ReplyTarget } from "../types";
import {
  formatRelativeTime,
  formatViews,
  isSameCommentUser,
  readAuthUserFromStorage,
  resolveCommentName
} from "../utils/helpers";
import {
  COMIC_DETAIL_COMMENTS_CHAPTER,
  STATUS_LABELS
} from "../constants/comic";
import {
  commentsKey,
  followKey,
  getReadChapterSet,
  lastReadKey,
  navigate,
  ratingKey,
  readPath,
  readStoredJson
} from "../utils/routing";
`;
fs.writeFileSync('src/pages/ComicDetail.tsx', `${comicDetailHeader}\n${comicDetailBody}`);
console.log('Created src/pages/ComicDetail.tsx');

// 2. ReaderView.tsx (lines 2288 to 2661)
const readerViewBody = getBlock(2288, 2661);
const readerViewHeader = `import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Eye,
  Heart,
  History,
  Home,
  MessageCircle,
  Moon,
  Palette,
  Send,
  Sun,
  ThumbsDown,
  ThumbsUp,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchChapter,
  fetchChapterComments,
  fetchOTruyenChapter,
  fetchTruyenQQChapter,
  postChapterComment,
  postOTruyenComment,
  postTruyenQQComment
} from "../api";
import { OptimizedImage } from "../components/common/OptimizedImage";
import { Notice } from "../components/common/UIComponents";
import { QQCommentPanel } from "../components/comic/ComicComponents";
import type { CatalogSource, DisplayComment, ReaderPayload, ReaderTheme, ReplyTarget } from "../types";
import {
  addReaderXp,
  formatRelativeTime,
  formatViews,
  isSameCommentUser,
  readAuthUserFromStorage,
  resolveCommentName
} from "../utils/helpers";
import {
  comicPath,
  followKey,
  getReadChapterSet,
  lastReadKey,
  markChapterRead,
  navigate,
  readPath
} from "../utils/routing";
`;
fs.writeFileSync('src/pages/ReaderView.tsx', `${readerViewHeader}\n${readerViewBody}`);
console.log('Created src/pages/ReaderView.tsx');

// 3. MovieDetailViewV2.tsx (lines 3120 to 4079)
const movieDetailBody = getBlock(3120, 4079);
const movieDetailHeader = `import { Check, Heart, Play, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fetchMovie } from "../api";
import { OptimizedImage } from "../components/common/OptimizedImage";
import { Notice } from "../components/common/UIComponents";
import { MovieCard, MovieStreamPlayer } from "../components/movie/MovieComponents";
import type { AuthUser, DisplayComment, FavoriteMovie, MovieDetail, MovieEpisode, ReplyTarget, WatchHistoryItem } from "../types";
import { formatRelativeTime, isSameCommentUser, readAuthUserFromStorage, resolveCommentName } from "../utils/helpers";
import { formatDateTime, readStoredJson } from "../utils/routing";
import { QQCommentPanel } from "../components/comic/ComicComponents";
`;
fs.writeFileSync('src/pages/MovieDetailViewV2.tsx', `${movieDetailHeader}\n${movieDetailBody}`);
console.log('Created src/pages/MovieDetailViewV2.tsx');

// 4. ImportView.tsx (lines 4080 to 4190)
const importViewBody = getBlock(4080, 4190);
const importViewHeader = `import { DownloadCloud, Upload } from "lucide-react";
import { useState } from "react";
import { importManifest } from "../api";
import { Notice } from "../components/common/UIComponents";
import { navigate } from "../utils/routing";

const sampleManifest = {
  title: "Truyện Demo Import",
  author: "Tác giả của bạn",
  description: "Manifest mẫu dùng asset nội bộ. Khi nhập nguồn thật, thay coverUrl và pages bằng URL ảnh bạn có quyền sử dụng.",
  status: "ongoing",
  genres: ["Phiêu lưu", "Demo"],
  coverUrl: "/sample/covers/neon-district.svg",
  source: {
    name: "Nguồn hợp lệ của bạn",
    license: "Owned or licensed"
  },
  chapters: [
    {
      title: "Chương 1: Bắt đầu",
      number: 1,
      pages: ["/sample/pages/neon-district-1.svg", "/sample/pages/neon-district-2.svg"]
    }
  ]
};
`;
fs.writeFileSync('src/pages/ImportView.tsx', `${importViewHeader}\n${importViewBody}`);
console.log('Created src/pages/ImportView.tsx');

// 5. UserDashboardModal.tsx (lines 4191 to 5303)
const userDashboardBody = getBlock(4191, 5303);
const userDashboardHeader = `import { Check, ChevronLeft, ChevronRight, Film, Layers3, Trash2, User, X } from "lucide-react";
import { useEffect, useState } from "react";
import { AVATAR_FRAME_REWARDS } from "../constants/comic";
import type { AuthUser, AvatarFrameReward, FavoriteMovie, WatchHistoryItem } from "../types";
import {
  avatarFrameStorageKey,
  getAvatarFrameById,
  getReaderLevelInfo,
  isAvatarFrameUnlocked,
  readAuthUserFromStorage,
  readReaderXp,
  readSelectedAvatarFrameId,
  saveReaderXp
} from "../utils/helpers";
import { formatDateTime, navigate } from "../utils/routing";
import { AvatarFrameBox } from "../components/common/AvatarFrameBox";
import { OptimizedImage } from "../components/common/OptimizedImage";
`;
fs.writeFileSync('src/components/modals/UserDashboardModal.tsx', `${userDashboardHeader}\n${userDashboardBody}`);
console.log('Created src/components/modals/UserDashboardModal.tsx');

// 6. AdminDashboardModal.tsx (lines 5304 to 6378)
const adminDashboardBody = getBlock(5304, 6378);
const adminDashboardHeader = `import { Lock, Plus, Trash2, User, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { AuthUser } from "../types";
import { Notice } from "../components/common/UIComponents";
`;
fs.writeFileSync('src/components/modals/AdminDashboardModal.tsx', `${adminDashboardHeader}\n${adminDashboardBody}`);
console.log('Created src/components/modals/AdminDashboardModal.tsx');
