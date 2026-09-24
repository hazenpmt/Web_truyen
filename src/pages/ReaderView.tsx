import {
  ArrowUp,
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
import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchChapter,
  fetchChapterComments,
  fetchComic,
  fetchOTruyenChapter,
  fetchOTruyenComic,
  fetchTruyenQQChapter,
  fetchTruyenQQComic,
  postChapterComment
} from "../api";
import { OptimizedImage } from "../components/common/OptimizedImage";
import { Link, Notice } from "../components/common/UIComponents";
import { QQCommentPanel } from "../components/comic/ComicComponents";
import { AVATAR_FRAME_NONE } from "../constants/comic";
import type { CatalogSource, Comic, DisplayComment, ReaderPayload, ReaderTheme, ReplyTarget } from "../types";
import {
  addReaderXp,
  formatRelativeTime,
  formatViews,
  getReaderLevelInfo,
  isSameCommentUser,
  readAuthUserFromStorage,
  readReaderXp,
  readSelectedAvatarFrameId,
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

export function ReaderView({ comicSlug, chapterSlug, source = "local" }: { comicSlug: string; chapterSlug: string; source?: CatalogSource }) {
  const [payload, setPayload] = useState<ReaderPayload | null>(null);
  const [comicDetail, setComicDetail] = useState<Comic | null>(null);
  const [error, setError] = useState("");
  const [theme] = useState<ReaderTheme>(() => (localStorage.getItem("readerTheme") as ReaderTheme) || "dark");
  const [readerWidth] = useState(() => Number(localStorage.getItem("readerWidth") || 820));
  const [followed, setFollowed] = useState(false);
  const [chapterComments, setChapterComments] = useState<DisplayComment[]>([]);
  const [commentName, setCommentName] = useState("Bạn đọc");
  const [commentText, setCommentText] = useState("");
  const [selectedSticker, setSelectedSticker] = useState("");
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false);
  const [commentBusy, setCommentBusy] = useState(false);
  const [readerNavVisible, setReaderNavVisible] = useState(true);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const lastScrollYRef = useRef(0);

  useEffect(() => {
    let ignore = false;
    const request = source === "otruyen" ? fetchOTruyenChapter(comicSlug, chapterSlug) : source === "truyenqq" ? fetchTruyenQQChapter(comicSlug, chapterSlug) : fetchChapter(comicSlug, chapterSlug);
    setPayload(null);
    setComicDetail(null);
    setError("");
    request
      .then((data) => {
        if (!ignore) {
          setPayload(data);
          setError("");
        }
      })
      .catch((error: Error) => {
        if (!ignore) setError(error.message);
      });
    return () => {
      ignore = true;
    };
  }, [comicSlug, chapterSlug, source]);

  useEffect(() => {
    let ignore = false;
    const detailRequest = source === "otruyen" ? fetchOTruyenComic(comicSlug) : source === "truyenqq" ? fetchTruyenQQComic(comicSlug) : fetchComic(comicSlug);
    detailRequest
      .then((data) => {
        if (!ignore) setComicDetail(data);
      })
      .catch(() => {
        if (!ignore) setComicDetail(null);
      });
    return () => {
      ignore = true;
    };
  }, [comicSlug, source]);

  useEffect(() => {
    let ignore = false;
    fetchChapterComments({ source, comicSlug, chapterSlug })
      .then((data) => {
        if (!ignore) setChapterComments(data.comments || []);
      })
      .catch(() => {
        if (!ignore) setChapterComments([]);
      });
    setCommentText("");
    setSelectedSticker("");
    setStickerPickerOpen(false);
    return () => {
      ignore = true;
    };
  }, [chapterSlug, comicSlug, source]);

  useEffect(() => {
    localStorage.setItem("readerTheme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("readerWidth", String(readerWidth));
  }, [readerWidth]);

  useEffect(() => {
    if (!payload) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") addReaderXp(1);
    }, 60000);
    return () => window.clearInterval(timer);
  }, [payload, comicSlug, chapterSlug, source]);

  useEffect(() => {
    const storedUser = (() => { try { return JSON.parse(localStorage.getItem("auth_user") || "null"); } catch { return null; } })();
    if (storedUser?.comicFollows) {
      setFollowed(storedUser.comicFollows.some((f: any) => f.slug === comicSlug && f.source === source));
    } else {
      setFollowed(localStorage.getItem(followKey(source, comicSlug)) === "1");
    }
  }, [comicSlug, source]);

  const progressKey = `reader-progress:${source}:${comicSlug}:${chapterSlug}`;

  useEffect(() => {
    if (!payload) return;
    localStorage.setItem(
      lastReadKey(source, comicSlug),
      JSON.stringify({ chapterSlug, chapterTitle: payload.chapter.title, updatedAt: new Date().toISOString() })
    );
    localStorage.setItem(
      `comic-details:${source}:${comicSlug}`,
      JSON.stringify({ title: payload.comic.title, cover: payload.comic.cover, slug: comicSlug, source })
    );
    markChapterRead(source, comicSlug, chapterSlug);
    const token = localStorage.getItem("auth_token") || "";
    if (token) {
      fetch("/api/user/comic-history", {
        method: "POST",
        headers: { "content-type": "application/json", "authorization": `Bearer ${token}` },
        body: JSON.stringify({
          slug: comicSlug,
          source,
          title: payload.comic.title,
          cover: payload.comic.cover,
          chapterSlug,
          chapterTitle: payload.chapter.title
        })
      }).then(r => r.ok ? r.json() : null)
        .then(data => { if (data?.user) localStorage.setItem("auth_user", JSON.stringify(data.user)); })
        .catch(() => {});
    }
  }, [chapterSlug, comicSlug, payload, source]);

  useEffect(() => {
    if (!payload) return;
    const saved = Number(localStorage.getItem(progressKey) || 0);
    const timeout = window.setTimeout(() => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (saved > 0 && maxScroll > 0) window.scrollTo({ top: maxScroll * saved });
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [payload, progressKey]);

  useEffect(() => {
    const onScroll = () => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (maxScroll <= 0) return;
      localStorage.setItem(progressKey, String(Math.min(1, window.scrollY / maxScroll).toFixed(4)));
      const currentY = Math.max(0, window.scrollY);
      const delta = currentY - lastScrollYRef.current;
      if (Math.abs(delta) > 8) {
        setReaderNavVisible(delta < 0 || currentY < 120);
        lastScrollYRef.current = currentY;
      }
      setShowScrollTop(currentY > 360);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [progressKey]);

  async function toggleFollow() {
    if (!payload) return;
    const next = !followed;
    setFollowed(next);
    localStorage.setItem(followKey(source, comicSlug), next ? "1" : "0");
    const token = localStorage.getItem("auth_token") || "";
    if (token) {
      try {
        const res = await fetch("/api/user/comic-follows/toggle", {
          method: "POST",
          headers: { "content-type": "application/json", "authorization": `Bearer ${token}` },
          body: JSON.stringify({ slug: comicSlug, source, title: payload.comic.title, cover: payload.comic.cover })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.user) localStorage.setItem("auth_user", JSON.stringify(data.user));
        }
      } catch {}
    }
  }

  async function submitChapterComment(reply?: ReplyTarget) {
    const text = commentText.trim();
    if ((!text && !selectedSticker) || commentBusy) return;
    setCommentBusy(true);
    try {
      const authUser = readAuthUserFromStorage();
      const authLevel = getReaderLevelInfo(readReaderXp(authUser), authUser?.role);
      const avatarFrame = readSelectedAvatarFrameId(authUser, authLevel.index);
      const data = await postChapterComment({
        source,
        comicSlug,
        chapterSlug,
        name: resolveCommentName(commentName, authUser),
        text,
        sticker: selectedSticker || undefined,
        avatar: authUser?.avatar,
        avatarFrame: avatarFrame !== AVATAR_FRAME_NONE ? avatarFrame : undefined,
        parentId: reply?.parentId,
        replyTo: reply?.replyTo
      });
      setChapterComments(data.comments || []);
      setCommentText("");
      setSelectedSticker("");
      setStickerPickerOpen(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Không gửi được bình luận.");
    } finally {
      setCommentBusy(false);
    }
  }

  if (error) {
    return (
      <main className="page">
        <Notice tone="error" message={error} />
      </main>
    );
  }

  if (!payload) {
    return <main className="page loading-row">Đang tải...</main>;
  }

  const chapters = (comicDetail?.chapters || [])
    .slice()
    .sort((a, b) => a.number - b.number);
  const chapterOptions = chapters.length ? chapters : [payload.chapter];
  const style = { "--reader-width": `${readerWidth}px` } as CSSProperties;
  const canGoPrevious = Boolean(payload.previousChapter);
  const canGoNext = Boolean(payload.nextChapter);
  const goToChapter = (nextSlug: string) => {
    if (nextSlug && nextSlug !== chapterSlug) navigate(readPath(source, payload.comic.slug, nextSlug));
  };
  const reportChapter = () => {
    window.alert("Đã ghi nhận báo lỗi chương. Admin sẽ kiểm tra lại nguồn ảnh/server.");
  };
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setReaderNavVisible(true);
  };

  return (
    <main className={`reader-screen theme-${theme}`} style={style}>
      <section className="reader-chapter-head">
        <div className="reader-breadcrumbs">
          <Link href="/">Trang chủ</Link>
          <span>/</span>
          <Link href={comicPath(source, payload.comic.slug)}>{payload.comic.title}</Link>
          <span>/</span>
          <strong>{payload.chapter.title}</strong>
        </div>
        <h1>{payload.comic.title} - {payload.chapter.title}</h1>
        <p>Đổi server nếu ảnh lỗi.</p>
        <div className="reader-server-row">
          <button className="selected">Server 1</button>
          <button>Server VIP</button>
          <button className="report" onClick={reportChapter}>Báo lỗi chương</button>
        </div>
        <div className="reader-tip">
          Chọn chương hoặc dùng nút trái/phải.
        </div>
        <div className="reader-head-nav">
          {payload.previousChapter ? (
            <Link className="reader-nav-link" href={readPath(source, payload.comic.slug, payload.previousChapter.slug)}>
              <ChevronLeft size={18} />
              <span>Chap trước</span>
            </Link>
          ) : (
            <span className="reader-nav-link disabled">
              <ChevronLeft size={18} />
              <span>Chap trước</span>
            </span>
          )}
          {payload.nextChapter ? (
            <Link className="reader-nav-link" href={readPath(source, payload.comic.slug, payload.nextChapter.slug)}>
              <span>Chap sau</span>
              <ChevronRight size={18} />
            </Link>
          ) : (
            <span className="reader-nav-link disabled">
              <span>Chap sau</span>
              <ChevronRight size={18} />
            </span>
          )}
        </div>
      </section>

      <div className="reader-stack">
        {payload.chapter.pages.length ? (
          payload.chapter.pages.map((page) => (
            <OptimizedImage key={page.index} src={page.image} alt={`${payload.chapter.title} - trang ${page.index}`} loading="lazy" referrerPolicy="no-referrer" />
          ))
        ) : (
          <div className="reader-empty-pages">Chương này chưa có ảnh. Hãy thử đổi server hoặc báo lỗi chương.</div>
        )}
      </div>

      <section className="reader-after-chapter">
        <div className="reader-head-nav">
          {payload.previousChapter ? (
            <Link className="reader-nav-link" href={readPath(source, payload.comic.slug, payload.previousChapter.slug)}>
              <ChevronLeft size={18} />
              <span>Chap trước</span>
            </Link>
          ) : (
            <span className="reader-nav-link disabled">
              <ChevronLeft size={18} />
              <span>Chap trước</span>
            </span>
          )}
          {payload.nextChapter ? (
            <Link className="reader-nav-link" href={readPath(source, payload.comic.slug, payload.nextChapter.slug)}>
              <span>Chap sau</span>
              <ChevronRight size={18} />
            </Link>
          ) : (
            <span className="reader-nav-link disabled">
              <span>Chap sau</span>
              <ChevronRight size={18} />
            </span>
          )}
        </div>
        <div className="reader-breadcrumbs">
          <Link href="/">Trang chủ</Link>
          <span>/</span>
          <Link href={comicPath(source, payload.comic.slug)}>{payload.comic.title}</Link>
          <span>/</span>
          <strong>{payload.chapter.title}</strong>
        </div>
      </section>

      <section className="reader-tab-panel">
        <QQCommentPanel
          comments={chapterComments}
          commentName={commentName}
          commentText={commentText}
          selectedSticker={selectedSticker}
          stickerPickerOpen={stickerPickerOpen}
          busy={commentBusy}
          emptyMessage="Chưa có bình luận nào cho chương này."
          reactionScope={`chapter:${source}:${comicSlug}:${chapterSlug}`}
          onNameChange={setCommentName}
          onTextChange={setCommentText}
          onStickerChange={setSelectedSticker}
          onPickerToggle={setStickerPickerOpen}
          onSubmit={submitChapterComment}
        />
      </section>

      <button className={showScrollTop && readerNavVisible ? "reader-scroll-top visible" : "reader-scroll-top"} onClick={scrollToTop} aria-label="Lên đầu trang">
        <ArrowUp size={20} />
      </button>

      <nav className={readerNavVisible ? "reader-floating-nav visible" : "reader-floating-nav hidden"} aria-label="Điều hướng đọc truyện">
        <Link href="/" className="reader-float-icon" ariaLabel="Trang chủ"><Home size={24} /></Link>
        <button className="reader-float-icon" onClick={() => window.history.back()} aria-label="Quay lại"><History size={24} /></button>
        <button className="reader-float-icon round" disabled={!canGoPrevious} onClick={() => payload.previousChapter && goToChapter(payload.previousChapter.slug)} aria-label="Chap trước">
          <ChevronLeft size={28} />
        </button>
        <select value={chapterSlug} onChange={(event) => goToChapter(event.target.value)} aria-label="Chọn chương">
          {chapterOptions.map((chapter) => (
            <option key={chapter.slug} value={chapter.slug}>{chapter.title}</option>
          ))}
        </select>
        <button className="reader-float-icon round" disabled={!canGoNext} onClick={() => payload.nextChapter && goToChapter(payload.nextChapter.slug)} aria-label="Chap sau">
          <ChevronRight size={28} />
        </button>
        <button className={followed ? "reader-follow active" : "reader-follow"} onClick={toggleFollow}>
          <Heart size={18} fill={followed ? "currentColor" : "none"} />
          <span>{followed ? "Đã theo dõi" : "Theo dõi"}</span>
        </button>
      </nav>
    </main>
  );
}
