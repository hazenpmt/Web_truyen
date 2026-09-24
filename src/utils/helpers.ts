import type { CSSProperties } from "react";
import { AVATAR_FRAME_NONE, AVATAR_FRAME_REWARDS, READER_LEVELS, READER_LEVEL_XP } from "../constants/comic";
import type { AuthUser, AvatarFrameReward, DisplayComment, ReaderLevelInfo } from "../types";

export function readAuthUserFromStorage(): AuthUser | null {
  try {
    return JSON.parse(localStorage.getItem("auth_user") || "null");
  } catch {
    return null;
  }
}

export function isSameCommentUser(comment: DisplayComment, authUser: AuthUser | null): boolean {
  if (!authUser) return false;
  if (authUser.role === "admin" && comment.role === "admin") return true;
  const names = [authUser.username, authUser.displayName].filter(Boolean).map((item) => String(item).trim().toLowerCase());
  return names.includes(comment.name.trim().toLowerCase());
}

export function resolveCommentName(input: string, authUser: AuthUser | null): string {
  const typedName = input.trim();
  const accountName = authUser?.displayName || authUser?.username || "";
  if (accountName && (!typedName || typedName === "Bạn đọc")) return accountName;
  return typedName || accountName || "Bạn đọc";
}

export function readerXpKey(authUser?: AuthUser | null): string {
  return authUser?.username ? `reader-xp:${authUser.username}` : "reader-xp:guest";
}

export function readReaderXp(authUser?: AuthUser | null): number {
  const value = Number(localStorage.getItem(readerXpKey(authUser)) || 0);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

export function saveReaderXp(xp: number, authUser?: AuthUser | null): number {
  const nextXp = Math.max(0, Math.floor(xp));
  localStorage.setItem(readerXpKey(authUser), String(nextXp));
  window.dispatchEvent(new Event("reader-xp-updated"));
  return nextXp;
}

export function addReaderXp(points: number): number {
  const authUser = readAuthUserFromStorage();
  const current = readReaderXp(authUser);
  return saveReaderXp(current + points, authUser);
}

export function avatarFrameStorageKey(authUser?: AuthUser | null): string {
  return authUser?.username ? `reader-avatar-frame:${authUser.username}` : "reader-avatar-frame:guest";
}

export function getAvatarFrameById(frameId?: string | null): AvatarFrameReward {
  return AVATAR_FRAME_REWARDS.find((frame) => frame.id === frameId) || AVATAR_FRAME_REWARDS[0];
}

export function isAvatarFrameUnlocked(frame: AvatarFrameReward, levelIndex: number, role?: AuthUser["role"]): boolean {
  if (frame.id === AVATAR_FRAME_NONE) return true;
  if (frame.adminOnly) return role === "admin";
  if (role === "admin") return true;
  return frame.unlockLevel <= levelIndex;
}

export function readSelectedAvatarFrameId(authUser: AuthUser | null | undefined, levelIndex: number): string {
  const stored = authUser?.avatarFrame || localStorage.getItem(avatarFrameStorageKey(authUser)) || AVATAR_FRAME_NONE;
  const frame = getAvatarFrameById(stored);
  return isAvatarFrameUnlocked(frame, levelIndex, authUser?.role) ? frame.id : AVATAR_FRAME_NONE;
}

export function getAvatarFrameStyle(frame: AvatarFrameReward): CSSProperties | undefined {
  return frame.image ? ({ "--avatar-frame-image": `url("${frame.image}")` } as CSSProperties) : undefined;
}

export function getAvatarFrameClass(frame: AvatarFrameReward): string {
  return frame.cssClass || "no-frame";
}

export function getReaderLevelInfo(xp: number, role?: AuthUser["role"]): ReaderLevelInfo {
  if (role === "admin") {
    const maxIndex = READER_LEVELS.length - 1;
    const maxXp = READER_LEVEL_XP[maxIndex];
    return {
      index: maxIndex,
      label: READER_LEVELS[maxIndex],
      nextLabel: READER_LEVELS[maxIndex],
      xp: Math.max(xp, maxXp),
      currentXp: maxXp,
      nextXp: maxXp,
      progress: 100,
      isMax: true
    };
  }

  let index = 0;
  for (let i = 0; i < READER_LEVEL_XP.length; i += 1) {
    if (xp >= READER_LEVEL_XP[i]) index = i;
  }
  const nextIndex = Math.min(index + 1, READER_LEVELS.length - 1);
  const currentXp = READER_LEVEL_XP[index] ?? 0;
  const nextXp = READER_LEVEL_XP[nextIndex] ?? currentXp;
  const progress = nextXp === currentXp ? 100 : Math.max(0, Math.min(100, ((xp - currentXp) / (nextXp - currentXp)) * 100));

  return {
    index,
    label: READER_LEVELS[index],
    nextLabel: READER_LEVELS[nextIndex],
    xp,
    currentXp,
    nextXp,
    progress,
    isMax: index === READER_LEVELS.length - 1
  };
}

export function getReaderLevel(comment: DisplayComment, comments: DisplayComment[]): { index: number; label: string } {
  if (comment.role === "admin") return { index: READER_LEVELS.length - 1, label: READER_LEVELS[READER_LEVELS.length - 1] };
  const authUser = readAuthUserFromStorage();
  const accountNames = [authUser?.username, authUser?.displayName].filter(Boolean).map((value) => String(value).trim().toLowerCase());
  if (accountNames.includes(comment.name.trim().toLowerCase())) {
    const level = getReaderLevelInfo(readReaderXp(authUser), authUser?.role);
    return { index: level.index, label: level.label };
  }
  const sameUserComments = comments.filter((item) => item.name.trim().toLowerCase() === comment.name.trim().toLowerCase()).length;
  const level = getReaderLevelInfo(sameUserComments * 10);
  return { index: level.index, label: level.label };
}

export function isImageSticker(value?: string): boolean {
  return Boolean(value && /\.(gif|png|webp|jpg|jpeg)(\?.*)?$/i.test(value));
}

export function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (60 * 1000));
    const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

    if (diffMins < 1) return "Vừa xong";
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    return `${diffDays} ngày trước`;
  } catch {
    return "";
  }
}

export function formatViews(views: number): string {
  if (!views) return "0";
  if (views >= 1000000) {
    return (views / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  }
  if (views >= 1000) {
    return (views / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  }
  return views.toLocaleString();
}
