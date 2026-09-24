import { Check, ChevronLeft, ChevronRight, Film, Layers3, Lock, Play, Trash2, User, X } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchComic, fetchOTruyenComic, fetchTruyenQQComic } from "../../api";
import { AVATAR_FRAME_NONE, AVATAR_FRAME_REWARDS } from "../../constants/comic";
import type { AuthUser, CatalogSource, Comic } from "../../types";
import {
  avatarFrameStorageKey,
  formatRelativeTime,
  getAvatarFrameById,
  getReaderLevelInfo,
  isAvatarFrameUnlocked,
  readReaderXp,
  readSelectedAvatarFrameId
} from "../../utils/helpers";
import { comicPath, formatDate, formatDateTime, formatNumber, readPath } from "../../utils/routing";
import { AvatarFrameBox } from "../common/AvatarFrameBox";
import { OptimizedImage } from "../common/OptimizedImage";
import { Link } from "../common/UIComponents";

export interface ComicFavoriteItem {
  title: string;
  cover: string;
  slug: string;
  source: CatalogSource;
  followedAt?: string;
  updatedAt?: string;
  latestChapterSlug?: string;
  latestChapterTitle?: string;
  latestChapterNumber?: number;
  totalChapters?: number;
}

export interface ComicHistoryItem {
  title: string;
  cover: string;
  slug: string;
  source: CatalogSource;
  chapterSlug: string;
  chapterTitle: string;
  updatedAt: string;
}

const ACCOUNT_COMICS_PER_PAGE = 30;

function latestChapterOf(comic: Comic) {
  return [...(comic.chapters || [])].sort((a, b) => b.number - a.number)[0];
}

function comicTimestamp(value?: string) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

async function fetchComicBySource(source: CatalogSource, slug: string) {
  if (source === "otruyen") return fetchOTruyenComic(slug);
  if (source === "truyenqq") return fetchTruyenQQComic(slug);
  return fetchComic(slug);
}

function sortComicFavorites(items: ComicFavoriteItem[]) {
  return [...items].sort((a, b) => {
    const updateDiff = comicTimestamp(b.updatedAt) - comicTimestamp(a.updatedAt);
    if (updateDiff !== 0) return updateDiff;
    return comicTimestamp(b.followedAt) - comicTimestamp(a.followedAt);
  });
}

async function enrichComicFavorites(items: ComicFavoriteItem[]) {
  const enriched = await Promise.all(items.map(async (item) => {
    try {
      const comic = await fetchComicBySource(item.source, item.slug);
      const latest = latestChapterOf(comic);
      const updatedAt = latest?.createdAt || comic.updatedAt || item.updatedAt || item.followedAt;
      localStorage.setItem(
        `comic-details:${item.source}:${item.slug}`,
        JSON.stringify({ title: comic.title, cover: comic.cover, slug: item.slug, source: item.source, updatedAt })
      );
      return {
        ...item,
        title: comic.title || item.title,
        cover: comic.cover || item.cover,
        updatedAt,
        latestChapterSlug: latest?.slug,
        latestChapterTitle: latest?.title,
        latestChapterNumber: latest?.number,
        totalChapters: comic.chapters?.length || item.totalChapters
      };
    } catch {
      return item;
    }
  }));
  return sortComicFavorites(enriched);
}

function getComicFavorites(): ComicFavoriteItem[] {
  const favs: ComicFavoriteItem[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith("comic-follow:")) {
      const isFollowed = localStorage.getItem(key) === "1";
      if (isFollowed) {
        const parts = key.split(":");
        const source = parts[1] as CatalogSource;
        const slug = parts[2];
        const detailsJson = localStorage.getItem(`comic-details:${source}:${slug}`);
        if (detailsJson) {
          try {
            const parsed = JSON.parse(detailsJson);
            favs.push({
              title: parsed.title || slug,
              cover: parsed.cover || "",
              slug: parsed.slug || slug,
              source: parsed.source || source,
              followedAt: parsed.followedAt,
              updatedAt: parsed.updatedAt,
              latestChapterSlug: parsed.latestChapterSlug,
              latestChapterTitle: parsed.latestChapterTitle,
              latestChapterNumber: parsed.latestChapterNumber,
              totalChapters: parsed.totalChapters
            });
          } catch {
            favs.push({ title: slug, cover: "", slug, source });
          }
        } else {
          favs.push({ title: slug, cover: "", slug, source });
        }
      }
    }
  }
  return favs;
}

function getComicHistory(): ComicHistoryItem[] {
  const history: ComicHistoryItem[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith("reader-last:")) {
      const parts = key.split(":");
      const source = parts[1] as CatalogSource;
      const slug = parts[2];
      const progressJson = localStorage.getItem(key);
      if (progressJson) {
        try {
          const progress = JSON.parse(progressJson);
          const detailsJson = localStorage.getItem(`comic-details:${source}:${slug}`);
          let title = slug;
          let cover = "";
          if (detailsJson) {
            try {
              const parsed = JSON.parse(detailsJson);
              title = parsed.title || slug;
              cover = parsed.cover || "";
            } catch {}
          }
          history.push({
            title,
            cover,
            slug,
            source,
            chapterSlug: progress.chapterSlug || "",
            chapterTitle: progress.chapterTitle || "",
            updatedAt: progress.updatedAt || new Date().toISOString()
          });
        } catch {}
      }
    }
  }
  return history.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function ReaderLevelCard({
  authUser,
  avatar,
  onUpdateUser
}: {
  authUser: AuthUser | null;
  avatar?: string;
  onUpdateUser?: (user: AuthUser) => void;
}) {
  const [xp, setXp] = useState(() => readReaderXp(authUser));
  const initialLevel = getReaderLevelInfo(readReaderXp(authUser), authUser?.role);
  const [selectedFrameId, setSelectedFrameId] = useState(() => readSelectedAvatarFrameId(authUser, initialLevel.index));
  const [previewFrameId, setPreviewFrameId] = useState(selectedFrameId);
  const [frameBusy, setFrameBusy] = useState(false);
  const [frameMessage, setFrameMessage] = useState("");

  useEffect(() => {
    const refresh = () => setXp(readReaderXp(authUser));
    refresh();
    window.addEventListener("reader-xp-updated", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("reader-xp-updated", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [authUser?.username, authUser?.role]);

  const level = getReaderLevelInfo(xp, authUser?.role);
  const avatarSrc = avatar || authUser?.avatar || `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(authUser?.username || "reader")}`;
  const progressLabel = level.isMax ? "MAX" : `${Math.round(level.progress)}%`;
  const selectedFrame = getAvatarFrameById(selectedFrameId);
  const previewFrame = getAvatarFrameById(previewFrameId);

  useEffect(() => {
    const nextFrameId = readSelectedAvatarFrameId(authUser, level.index);
    setSelectedFrameId(nextFrameId);
    setPreviewFrameId(nextFrameId);
  }, [authUser?.username, authUser?.role, authUser?.avatarFrame, level.index]);

  const applyFrame = async (frameId = previewFrameId) => {
    const frame = getAvatarFrameById(frameId);
    if (!authUser || !isAvatarFrameUnlocked(frame, level.index, authUser.role) || frameBusy) return;
    setFrameBusy(true);
    setFrameMessage("");
    try {
      const nextFrameId = frame.id;
      localStorage.setItem(avatarFrameStorageKey(authUser), nextFrameId);
      const token = localStorage.getItem("auth_token") || "";
      if (token) {
        const res = await fetch("/api/user/profile", {
          method: "PUT",
          headers: {
            "content-type": "application/json",
            "authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ avatarFrame: nextFrameId === AVATAR_FRAME_NONE ? "" : nextFrameId })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Không thể lưu khung avatar.");
        localStorage.setItem("auth_user", JSON.stringify(data.user));
        onUpdateUser?.(data.user);
        window.dispatchEvent(new CustomEvent("auth-user-updated", { detail: data.user }));
      }
      setSelectedFrameId(nextFrameId);
      setPreviewFrameId(nextFrameId);
      setFrameMessage(nextFrameId === AVATAR_FRAME_NONE ? "Đã tắt khung avatar." : "Đã dùng khung avatar.");
    } catch (error) {
      setFrameMessage(error instanceof Error ? error.message : "Không thể lưu khung avatar.");
    } finally {
      setFrameBusy(false);
    }
  };

  return (
    <section className="reader-level-section">
      <h3>Thông tin cấp độ</h3>
      <div className="reader-level-card">
        <AvatarFrameBox frame={previewFrame} className="reader-level-avatar-ring">
          <OptimizedImage src={avatarSrc} alt={authUser?.username || "Bạn đọc"} />
        </AvatarFrameBox>
        {previewFrame.id !== selectedFrame.id && (
          <small className="frame-preview-note">Đang xem thử: {previewFrame.label}</small>
        )}
        <strong className="reader-level-user">{authUser?.displayName || authUser?.username || "Bạn đọc"}</strong>
        <div className="reader-level-range">
          <span>{level.label}</span>
          <span>{progressLabel}</span>
          <span>{level.nextLabel}</span>
        </div>
        <div className="reader-exp-track" aria-label="Tiến độ cấp độ">
          <div className="reader-exp-fill" style={{ width: `${level.progress}%` }} />
        </div>
        <div className="reader-level-stats">
          <div>
            <small>QQcoin</small>
            <strong>0</strong>
          </div>
          <div>
            <small>Xếp hạng</small>
            <strong>--</strong>
          </div>
          <div>
            <small>Cấp bậc</small>
            <strong>{level.label}</strong>
          </div>
        </div>
        <p className="reader-level-note">
          Đã tích lũy {formatNumber(level.xp)} điểm. Cứ đọc truyện 1 phút được cộng 1 điểm.
        </p>
      </div>

      <h3>Phần thưởng level</h3>
      <div className="reader-level-reward">
        <div className="level-frame-preview-grid">
          {AVATAR_FRAME_REWARDS.map((frame) => {
            const unlocked = isAvatarFrameUnlocked(frame, level.index, authUser?.role);
            const selected = selectedFrame.id === frame.id;
            const previewing = previewFrame.id === frame.id;
            const lockTitle = frame.adminOnly ? "Khung chỉ dành cho admin. Bạn vẫn có thể xem thử." : "Chưa đủ điều kiện mở. Bạn vẫn có thể xem thử.";
            return (
              <button
                key={frame.id}
                type="button"
                className={`level-frame-preview ${unlocked ? "unlocked" : "locked"} ${selected ? "selected" : ""} ${previewing ? "previewing" : ""}`}
                aria-disabled={!unlocked}
                title={unlocked ? `Xem thử ${frame.label}` : lockTitle}
                onClick={() => setPreviewFrameId(frame.id)}
              >
                <AvatarFrameBox frame={frame} className="level-frame-swatch">
                  {frame.id === AVATAR_FRAME_NONE && <X size={20} />}
                  {!unlocked && <Lock className="frame-lock-icon" size={20} />}
                </AvatarFrameBox>
                <small>{frame.label}</small>
                {selected && <span className="frame-selected-mark">Đang dùng</span>}
              </button>
            );
          })}
        </div>
        <div className="level-frame-actions">
          <button
            type="button"
            className="secondary-action"
            disabled={frameBusy || previewFrame.id === selectedFrame.id || !isAvatarFrameUnlocked(previewFrame, level.index, authUser?.role)}
            onClick={() => applyFrame(previewFrame.id)}
          >
            Dùng khung này
          </button>
          <button
            type="button"
            className="secondary-action"
            disabled={frameBusy || selectedFrame.id === AVATAR_FRAME_NONE}
            onClick={() => applyFrame(AVATAR_FRAME_NONE)}
          >
            Tắt khung
          </button>
        </div>
        {frameMessage && <small className="frame-message">{frameMessage}</small>}
      </div>
    </section>
  );
}

function MovieAccountCard({ authUser }: { authUser: AuthUser | null }) {
  return (
    <section className="movie-account-section">
      <h3>Không gian phim</h3>
      <div className="movie-account-card">
        <div>
          <small>Phim yêu thích</small>
          <strong>{authUser?.favorites?.length || 0}</strong>
        </div>
        <div>
          <small>Diễn viên yêu thích</small>
          <strong>{authUser?.favoriteActors?.length || 0}</strong>
        </div>
        <div>
          <small>Lịch sử xem</small>
          <strong>{authUser?.watchHistory?.length || 0}</strong>
        </div>
      </div>
      <p className="movie-account-note">Cấp độ đọc truyện chỉ tính ở web truyện; web phim sẽ có hệ thống riêng sau.</p>
    </section>
  );
}

function AccountPagination({
  page,
  totalPages,
  onPageChange
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);
  return (
    <div className="account-comic-pagination" aria-label="Chuyển trang">
      <button type="button" disabled={page <= 1} onClick={() => onPageChange(1)}>«</button>
      <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>‹</button>
      {pages.map((item) => (
        <button
          key={item}
          type="button"
          className={item === page ? "selected" : ""}
          onClick={() => onPageChange(item)}
        >
          {item}
        </button>
      ))}
      <button type="button" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>›</button>
      <button type="button" disabled={page >= totalPages} onClick={() => onPageChange(totalPages)}>»</button>
    </div>
  );
}

function ComicAccountGrid({
  title,
  items,
  page,
  onPageChange,
  emptyText,
  refreshing,
  kind,
  onRemove,
  onNavigate
}: {
  title: string;
  items: Array<ComicFavoriteItem | ComicHistoryItem>;
  page: number;
  onPageChange: (page: number) => void;
  emptyText: string;
  refreshing?: boolean;
  kind: "favorites" | "history";
  onRemove: (source: CatalogSource, slug: string) => void;
  onNavigate?: () => void;
}) {
  const totalPages = Math.max(1, Math.ceil(items.length / ACCOUNT_COMICS_PER_PAGE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const visibleItems = items.slice((safePage - 1) * ACCOUNT_COMICS_PER_PAGE, safePage * ACCOUNT_COMICS_PER_PAGE);

  return (
    <section className="account-comic-list">
      <div className="account-comic-list-head">
        <h3>{title} ({items.length})</h3>
        {refreshing && <span>Đang cập nhật...</span>}
      </div>

      {items.length === 0 ? (
        <p className="account-empty-text">{emptyText}</p>
      ) : (
        <>
          <div className="account-comic-grid">
            {visibleItems.map((item) => {
              const favorite = item as ComicFavoriteItem;
              const history = item as ComicHistoryItem;
              const isFavorite = kind === "favorites";
              const chapterSlug = isFavorite ? favorite.latestChapterSlug : history.chapterSlug;
              const chapterTitle = isFavorite ? favorite.latestChapterTitle : history.chapterTitle;
              const updatedAt = isFavorite ? favorite.updatedAt : history.updatedAt;
              const cardHref = isFavorite ? comicPath(item.source, item.slug) : readPath(item.source, item.slug, chapterSlug || "");
              const chapterHref = chapterSlug ? readPath(item.source, item.slug, chapterSlug) : comicPath(item.source, item.slug);

              return (
                <article key={`${kind}-${item.source}-${item.slug}`} className="account-comic-card">
                  <Link className="account-comic-cover" href={cardHref} onClick={() => onNavigate?.()}>
                    {updatedAt && <span className="account-comic-badge">{formatRelativeTime(updatedAt)}</span>}
                    <OptimizedImage src={item.cover} alt={item.title} referrerPolicy="no-referrer" />
                  </Link>
                  <button
                    type="button"
                    className="account-comic-remove"
                    onClick={() => onRemove(item.source, item.slug)}
                    title={isFavorite ? "Bỏ theo dõi" : "Xóa lịch sử"}
                    aria-label={isFavorite ? "Bỏ theo dõi" : "Xóa lịch sử"}
                  >
                    <X size={16} />
                  </button>
                  <Link className="account-comic-title" href={comicPath(item.source, item.slug)} onClick={() => onNavigate?.()}>
                    {item.title}
                  </Link>
                  <Link className="account-comic-chapter" href={chapterHref} onClick={() => onNavigate?.()}>
                    {chapterTitle ? `Đọc Tiếp ${chapterTitle}` : "Mở truyện"}
                  </Link>
                </article>
              );
            })}
          </div>
          <AccountPagination page={safePage} totalPages={totalPages} onPageChange={onPageChange} />
        </>
      )}
    </section>
  );
}

export function UserDashboardModal({
  tab,
  onClose,
  authUser,
  onUpdateUser,
  mode,
  embedded = false
}: {
  tab: "profile" | "favorites" | "history";
  onClose: () => void;
  authUser: AuthUser | null;
  onUpdateUser: (user: AuthUser) => void;
  mode: "movie" | "comic";
  embedded?: boolean;
}) {
  const [currentTab, setCurrentTab] = useState(tab);

  useEffect(() => {
    setCurrentTab(tab);
  }, [tab]);
  
  const [displayName, setDisplayName] = useState(authUser?.displayName || authUser?.username || "");
  const [avatar, setAvatar] = useState(authUser?.avatar || "");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileError, setProfileError] = useState("");

  const serverUser = (() => { try { return JSON.parse(localStorage.getItem("auth_user") || "null"); } catch { return null; } })();
  const [comicFavorites, setComicFavorites] = useState<ComicFavoriteItem[]>(() => {
    if (serverUser?.comicFollows?.length) {
      return serverUser.comicFollows.map((f: any) => ({
        title: f.title || f.slug,
        cover: f.cover || "",
        slug: f.slug,
        source: f.source as CatalogSource,
        followedAt: f.followedAt,
        updatedAt: f.updatedAt,
        latestChapterSlug: f.latestChapterSlug,
        latestChapterTitle: f.latestChapterTitle,
        latestChapterNumber: f.latestChapterNumber,
        totalChapters: f.totalChapters
      }));
    }
    return getComicFavorites();
  });
  const [comicHistory, setComicHistory] = useState<ComicHistoryItem[]>(() => {
    if (serverUser?.comicHistory?.length) {
      return serverUser.comicHistory.map((h: any) => ({
        title: h.title || h.slug,
        cover: h.cover || "",
        slug: h.slug,
        source: h.source as CatalogSource,
        chapterSlug: h.chapterSlug || "",
        chapterTitle: h.chapterTitle || "",
        updatedAt: h.updatedAt || new Date().toISOString()
      }));
    }
    return getComicHistory();
  });
  const [comicFavoritePage, setComicFavoritePage] = useState(1);
  const [comicHistoryPage, setComicHistoryPage] = useState(1);
  const [comicFavoritesRefreshing, setComicFavoritesRefreshing] = useState(false);

  useEffect(() => {
    setComicFavoritePage(1);
    setComicHistoryPage(1);
  }, [currentTab, mode]);

  useEffect(() => {
    setComicFavoritePage((page) => Math.min(page, Math.max(1, Math.ceil(comicFavorites.length / ACCOUNT_COMICS_PER_PAGE))));
  }, [comicFavorites.length]);

  useEffect(() => {
    setComicHistoryPage((page) => Math.min(page, Math.max(1, Math.ceil(comicHistory.length / ACCOUNT_COMICS_PER_PAGE))));
  }, [comicHistory.length]);

  useEffect(() => {
    if (mode !== "comic") return;
    let ignore = false;
    const readServerUser = () => {
      try { return JSON.parse(localStorage.getItem("auth_user") || "null"); } catch { return null; }
    };
    const normalizeFollows = () => {
      const stored = readServerUser();
      if (stored?.comicFollows?.length) {
        return stored.comicFollows.map((f: any) => ({
          title: f.title || f.slug,
          cover: f.cover || "",
          slug: f.slug,
          source: f.source as CatalogSource,
          followedAt: f.followedAt,
          updatedAt: f.updatedAt,
          latestChapterSlug: f.latestChapterSlug,
          latestChapterTitle: f.latestChapterTitle,
          latestChapterNumber: f.latestChapterNumber,
          totalChapters: f.totalChapters
        }));
      }
      return getComicFavorites();
    };
    const normalizeHistory = () => {
      const stored = readServerUser();
      if (stored?.comicHistory?.length) {
        return stored.comicHistory.map((h: any) => ({
          title: h.title || h.slug,
          cover: h.cover || "",
          slug: h.slug,
          source: h.source as CatalogSource,
          chapterSlug: h.chapterSlug || "",
          chapterTitle: h.chapterTitle || "",
          updatedAt: h.updatedAt || new Date().toISOString()
        }));
      }
      return getComicHistory();
    };
    const refresh = async () => {
      const follows = normalizeFollows();
      setComicHistory(normalizeHistory());
      if (!follows.length) {
        setComicFavorites([]);
        setComicFavoritesRefreshing(false);
        return;
      }
      setComicFavoritesRefreshing(true);
      const enriched = await enrichComicFavorites(follows);
      if (!ignore) setComicFavorites(enriched);
      if (!ignore) setComicFavoritesRefreshing(false);
    };
    refresh();
    const interval = window.setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    return () => {
      ignore = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [mode, authUser?.username, authUser?.comicFollows?.length, authUser?.comicHistory?.length]);

  const handleToggleComicFavorite = async (source: CatalogSource, slug: string) => {
    localStorage.setItem(`comic-follow:${source}:${slug}`, "0");
    const token = localStorage.getItem("auth_token") || "";
    if (token) {
      try {
        const item = comicFavorites.find(f => f.slug === slug && f.source === source);
        const res = await fetch("/api/user/comic-follows/toggle", {
          method: "POST",
          headers: { "content-type": "application/json", "authorization": `Bearer ${token}` },
          body: JSON.stringify({ slug, source, title: item?.title || slug, cover: item?.cover || "" })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            localStorage.setItem("auth_user", JSON.stringify(data.user));
            onUpdateUser(data.user);
            setComicFavorites((data.user.comicFollows || []).map((f: any) => ({
              title: f.title || f.slug,
              cover: f.cover || "",
              slug: f.slug,
              source: f.source as CatalogSource,
              followedAt: f.followedAt,
              updatedAt: f.updatedAt,
              latestChapterSlug: f.latestChapterSlug,
              latestChapterTitle: f.latestChapterTitle,
              latestChapterNumber: f.latestChapterNumber,
              totalChapters: f.totalChapters
            })));
          }
        }
      } catch {}
    }
    setComicFavorites(prev => prev.filter(f => !(f.slug === slug && f.source === source)));
  };

  const handleDeleteComicHistory = async (source: CatalogSource, slug: string) => {
    localStorage.removeItem(`reader-last:${source}:${slug}`);
    const token = localStorage.getItem("auth_token") || "";
    if (token) {
      try {
        const res = await fetch("/api/user/comic-history", {
          method: "DELETE",
          headers: { "content-type": "application/json", "authorization": `Bearer ${token}` },
          body: JSON.stringify({ slug, source })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            localStorage.setItem("auth_user", JSON.stringify(data.user));
            setComicHistory((data.user.comicHistory || []).map((h: any) => ({
              title: h.title || h.slug, cover: h.cover || "", slug: h.slug, source: h.source as CatalogSource,
              chapterSlug: h.chapterSlug || "", chapterTitle: h.chapterTitle || "", updatedAt: h.updatedAt
            })));
            return;
          }
        }
      } catch {}
    }
    setComicHistory(prev => prev.filter(h => !(h.slug === slug && h.source === source)));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setProfileError("");
    setProfileSuccess("");
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = 160;
        canvas.height = 160;
        
        const size = Math.min(img.width, img.height);
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;
        
        ctx?.drawImage(img, sx, sy, size, size, 0, 0, 160, 160);
        const base64 = canvas.toDataURL("image/jpeg", 0.85);
        setAvatar(base64);
      };
      img.onerror = () => {
        setProfileError("Không thể đọc tệp ảnh này.");
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      setProfileError("Không thể đọc tệp này.");
    };
    reader.readAsDataURL(file);
  };

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError("");
    setProfileSuccess("");
    setProfileLoading(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          "authorization": `Bearer ${localStorage.getItem("auth_token") || ""}`
        },
        body: JSON.stringify({ displayName, avatar })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Không thể cập nhật hồ sơ.");
      onUpdateUser(data.user);
      localStorage.setItem("auth_user", JSON.stringify(data.user));
      setDisplayName(data.user.displayName || data.user.username || "");
      setAvatar(data.user.avatar || "");
      window.dispatchEvent(new CustomEvent("auth-user-updated", { detail: data.user }));
      setProfileSuccess("Cập nhật thông tin cá nhân thành công!");
    } catch (err: unknown) {
      setProfileError(err instanceof Error ? err.message : "Có lỗi xảy ra.");
    } finally {
      setProfileLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");
    setPasswordLoading(true);
    try {
      const res = await fetch("/api/user/password", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          "authorization": `Bearer ${localStorage.getItem("auth_token") || ""}`
        },
        body: JSON.stringify({ oldPassword, newPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Không thể đổi mật khẩu.");
      setPasswordSuccess("Đổi mật khẩu thành công!");
      setOldPassword("");
      setNewPassword("");
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : "Có lỗi xảy ra.");
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleToggleFavorite = async (type: "movie" | "actor", itemPayload: any) => {
    try {
      const bodyPayload = type === "movie" 
        ? { type, movie: itemPayload } 
        : { type, actorName: itemPayload };
        
      const res = await fetch("/api/user/favorites/toggle", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "authorization": `Bearer ${localStorage.getItem("auth_token") || ""}`
        },
        body: JSON.stringify(bodyPayload)
      });
      const data = await res.json();
      if (res.ok && data.user) {
        onUpdateUser(data.user);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const content = (
      <div className={embedded ? "account-page-panel" : "auth-modal"} style={{ width: embedded ? "min(1180px, calc(100vw - 32px))" : "min(640px, calc(100vw - 32px))", padding: "28px 24px" }}>
        <button className="auth-modal-close" onClick={onClose} aria-label="Đóng">
          <X size={20} />
        </button>

        <h2 style={{ fontSize: "1.3rem", fontWeight: 800, marginBottom: "18px", color: "var(--ink)" }}>
          Bảng điều khiển cá nhân
        </h2>

        <div className="auth-tabs" style={{ marginBottom: "20px" }}>
          <button className={currentTab === "profile" ? "selected" : ""} onClick={() => setCurrentTab("profile")}>
            Hồ sơ
          </button>
          <button className={currentTab === "favorites" ? "selected" : ""} onClick={() => setCurrentTab("favorites")}>
            Yêu thích
          </button>
          <button className={currentTab === "history" ? "selected" : ""} onClick={() => setCurrentTab("history")}>
            {mode === "movie" ? "Xem tiếp" : "Đọc tiếp"}
          </button>
        </div>

        {currentTab === "profile" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <form onSubmit={handleUpdateProfile} className="auth-form" style={{ gap: "12px" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, borderBottom: "1px solid var(--line)", paddingBottom: "6px" }}>
                Thông tin cá nhân
              </h3>
              
              <div style={{ display: "flex", gap: "16px", alignItems: "center", marginBottom: "8px" }}>
                <div style={{ width: 64, height: 64, borderRadius: "50%", overflow: "hidden", background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--line)" }}>
                  {avatar ? (
                    <OptimizedImage src={avatar} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { (e.target as any).src = `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(authUser?.username || "")}` }} />
                  ) : (
                    <User size={32} />
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Tên tài khoản:</span>
                  <strong style={{ display: "block", fontSize: "1.05rem" }}>@{authUser?.username}</strong>
                </div>
              </div>

              <label className="auth-field">
                <span>Tên hiển thị</span>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Nhập tên hiển thị"
                  required
                  disabled={profileLoading}
                />
              </label>

              <label className="auth-field">
                <span>Chọn ảnh từ thiết bị của bạn</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  disabled={profileLoading}
                  style={{
                    fontSize: "0.88rem",
                    padding: "6px 0",
                    border: "none",
                    background: "transparent",
                    color: "var(--ink)",
                    cursor: "pointer"
                  }}
                />
              </label>

              <label className="auth-field">
                <span>Hoặc nhập đường dẫn ảnh (URL)</span>
                <input
                  type="text"
                  value={avatar}
                  onChange={(e) => setAvatar(e.target.value)}
                  placeholder="Nhập URL ảnh đại diện"
                  disabled={profileLoading}
                />
              </label>

              {profileSuccess && (
                <div style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.4)", borderRadius: "8px", padding: "10px 14px", color: "#10b981", fontSize: "0.88rem", fontWeight: 600 }}>
                  {profileSuccess}
                </div>
              )}

              {profileError && (
                <div style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: "8px", padding: "10px 14px", color: "#ef4444", fontSize: "0.88rem", fontWeight: 600 }}>
                  {profileError}
                </div>
              )}

              <button className="auth-submit-btn" type="submit" disabled={profileLoading} style={{ marginTop: "6px" }}>
                <span>{profileLoading ? "Đang cập nhật..." : "Lưu thay đổi"}</span>
              </button>
            </form>

            {mode === "comic" ? (
              <ReaderLevelCard authUser={authUser} avatar={avatar} onUpdateUser={onUpdateUser} />
            ) : (
              <MovieAccountCard authUser={authUser} />
            )}

            <form onSubmit={handleChangePassword} className="auth-form" style={{ gap: "12px" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, borderBottom: "1px solid var(--line)", paddingBottom: "6px" }}>
                Đổi mật khẩu
              </h3>

              <label className="auth-field">
                <span>Mật khẩu cũ</span>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="Nhập mật khẩu hiện tại"
                  required
                  disabled={passwordLoading}
                />
              </label>

              <label className="auth-field">
                <span>Mật khẩu mới</span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nhập mật khẩu mới (ít nhất 6 ký tự)"
                  required
                  disabled={passwordLoading}
                />
              </label>

              {passwordSuccess && (
                <div style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.4)", borderRadius: "8px", padding: "10px 14px", color: "#10b981", fontSize: "0.88rem", fontWeight: 600 }}>
                  {passwordSuccess}
                </div>
              )}

              {passwordError && (
                <div style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: "8px", padding: "10px 14px", color: "#ef4444", fontSize: "0.88rem", fontWeight: 600 }}>
                  {passwordError}
                </div>
              )}

              <button className="auth-submit-btn" type="submit" disabled={passwordLoading} style={{ marginTop: "6px" }}>
                <Lock size={15} />
                <span>{passwordLoading ? "Đang xử lý..." : "Đổi mật khẩu"}</span>
              </button>
            </form>
          </div>
        )}

        {currentTab === "favorites" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxHeight: embedded ? "none" : "400px", overflowY: embedded ? "visible" : "auto", paddingRight: "4px" }}>
            {mode === "movie" ? (
              <>
                <div>
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, borderBottom: "1px solid var(--line)", paddingBottom: "6px", marginBottom: "12px" }}>
                    Phim yêu thích ({authUser?.favorites?.length || 0})
                  </h3>
                  
                  {!authUser?.favorites || authUser.favorites.length === 0 ? (
                    <p style={{ color: "var(--muted)", fontStyle: "italic", fontSize: "0.9rem" }}>Chưa có phim yêu thích nào.</p>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "14px" }}>
                      {authUser.favorites.map((fav) => (
                        <div 
                          key={fav.slug} 
                          style={{ 
                            position: "relative", 
                            background: "var(--surface-2)", 
                            borderRadius: "8px", 
                            overflow: "hidden", 
                            border: "1px solid var(--line)",
                            display: "flex",
                            flexDirection: "column"
                          }}
                        >
                          <Link 
                            href={`/movie/${fav.slug}`} 
                            onClick={onClose}
                            style={{ flex: 1, display: "flex", flexDirection: "column" }}
                          >
                            <div style={{ aspectRatio: "2/3", width: "100%", background: "#000", overflow: "hidden" }}>
                              <OptimizedImage src={fav.poster} alt={fav.title} style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.2s" }} />
                            </div>
                            <div style={{ padding: "8px", fontSize: "0.82rem", fontWeight: 600, color: "var(--ink)", flex: 1, display: "flex", alignItems: "center" }}>
                              <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{fav.title}</span>
                            </div>
                          </Link>
                          <button 
                            onClick={() => handleToggleFavorite("movie", fav)}
                            style={{ 
                              position: "absolute", 
                              top: "6px", 
                              right: "6px", 
                              background: "rgba(0,0,0,0.7)", 
                              color: "#ff4757", 
                              border: "none", 
                              borderRadius: "50%", 
                              width: "28px", 
                              height: "28px", 
                              display: "flex", 
                              alignItems: "center", 
                              justifyContent: "center", 
                              cursor: "pointer",
                              padding: 0
                            }}
                            title="Bỏ yêu thích"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, borderBottom: "1px solid var(--line)", paddingBottom: "6px", marginBottom: "12px" }}>
                    Diễn viên yêu thích ({authUser?.favoriteActors?.length || 0})
                  </h3>

                  {!authUser?.favoriteActors || authUser.favoriteActors.length === 0 ? (
                    <p style={{ color: "var(--muted)", fontStyle: "italic", fontSize: "0.9rem" }}>Chưa có diễn viên yêu thích nào.</p>
                  ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {authUser.favoriteActors.map((actor) => (
                        <div 
                          key={actor} 
                          className="chip" 
                          style={{ 
                            display: "inline-flex", 
                            alignItems: "center", 
                            gap: "6px", 
                            padding: "6px 12px", 
                            background: "var(--surface-2)",
                            border: "1px solid var(--line)",
                            borderRadius: "20px",
                            fontSize: "0.85rem",
                            fontWeight: 600
                          }}
                        >
                          <span>{actor}</span>
                          <button 
                            onClick={() => handleToggleFavorite("actor", actor)}
                            style={{ 
                              background: "none", 
                              border: "none", 
                              color: "var(--muted)", 
                              cursor: "pointer", 
                              padding: 0, 
                              display: "inline-flex", 
                              alignItems: "center" 
                            }}
                            title="Bỏ yêu thích"
                          >
                            <X size={14} style={{ color: "#ff4757" }} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <ComicAccountGrid
                title="Truyện đang theo dõi"
                items={sortComicFavorites(comicFavorites)}
                page={comicFavoritePage}
                onPageChange={setComicFavoritePage}
                emptyText="Chưa có truyện theo dõi nào."
                refreshing={comicFavoritesRefreshing}
                kind="favorites"
                onRemove={handleToggleComicFavorite}
                onNavigate={embedded ? undefined : onClose}
              />
            )}
          </div>
        )}

        {currentTab === "history" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: embedded ? "none" : "400px", overflowY: embedded ? "visible" : "auto", paddingRight: "4px" }}>
            {mode === "movie" ? (
              <>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, borderBottom: "1px solid var(--line)", paddingBottom: "6px" }}>
                  Lịch sử xem gần đây ({authUser?.watchHistory?.length || 0})
                </h3>

                {!authUser?.watchHistory || authUser.watchHistory.length === 0 ? (
                  <p style={{ color: "var(--muted)", fontStyle: "italic", fontSize: "0.9rem", marginTop: "8px" }}>Chưa có lịch sử xem phim nào.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {authUser.watchHistory.map((item) => (
                      <Link 
                        key={`${item.slug}-${item.episodeSlug}`}
                        href={`/movie/${item.slug}/${item.episodeSlug}`}
                        onClick={onClose}
                        style={{ 
                          display: "flex", 
                          gap: "14px", 
                          alignItems: "center", 
                          background: "var(--surface-2)", 
                          padding: "10px 14px", 
                          borderRadius: "10px", 
                          border: "1px solid var(--line)", 
                          transition: "background 0.2s, transform 0.1s"
                        }}
                        className="history-item-row"
                      >
                        <OptimizedImage 
                          src={item.poster} 
                          alt="" 
                          style={{ width: "45px", height: "60px", objectFit: "cover", borderRadius: "6px" }} 
                        />
                        <div style={{ flex: 1 }}>
                          <strong style={{ display: "block", fontSize: "0.95rem", color: "var(--ink)" }}>{item.title}</strong>
                          <span style={{ fontSize: "0.82rem", color: "var(--gold,#f59e0b)", fontWeight: 700 }}>Tập {item.episodeName}</span>
                          <small style={{ display: "block", color: "var(--muted)", fontSize: "0.75rem", marginTop: "2px" }}>
                            Xem lần cuối: {formatDateTime(item.watchedAt)}
                          </small>
                        </div>
                        <Play size={18} style={{ color: "var(--muted)" }} />
                      </Link>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <ComicAccountGrid
                title="Lịch sử đọc gần đây"
                items={[...comicHistory].sort((a, b) => comicTimestamp(b.updatedAt) - comicTimestamp(a.updatedAt))}
                page={comicHistoryPage}
                onPageChange={setComicHistoryPage}
                emptyText="Chưa có lịch sử đọc truyện nào."
                kind="history"
                onRemove={handleDeleteComicHistory}
                onNavigate={embedded ? undefined : onClose}
              />
            )}
          </div>
        )}
      </div>
  );

  if (embedded) {
    return <main className="page account-page">{content}</main>;
  }

  return (
    <div className="auth-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      {content}
    </div>
  );
}
