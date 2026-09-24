import { ArrowUp, BookOpen, Check, ChevronLeft, ChevronRight, Eye, Heart, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  fetchChapterComments,
  fetchComic,
  fetchOTruyenComic,
  fetchTruyenQQComic,
  postChapterComment
} from "../api";
import { OptimizedImage } from "../components/common/OptimizedImage";
import { Link, MetaItem, Notice } from "../components/common/UIComponents";
import { QQCommentPanel } from "../components/comic/ComicComponents";
import type { CatalogSource, Comic, ComicComment, DisplayComment, LastRead, ReplyTarget } from "../types";
import {
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
  AVATAR_FRAME_NONE,
  COMIC_DETAIL_COMMENTS_CHAPTER,
  STATUS_LABELS
} from "../constants/comic";
import {
  commentsKey,
  followKey,
  formatDate,
  formatNumber,
  getGenreSlug,
  getReadChapterSet,
  lastReadKey,
  navigate,
  ratingKey,
  readPath,
  readStoredJson
} from "../utils/routing";

export function ComicDetail({ slug, source = "local", onSelectGenre }: { slug: string; source?: CatalogSource; onSelectGenre?: (genreSlug: string) => void }) {
  const [comic, setComic] = useState<Comic | null>(null);
  const [error, setError] = useState("");
  const [lastRead, setLastRead] = useState<LastRead | null>(null);
  const [followed, setFollowed] = useState(false);
  const [rating, setRating] = useState(0);
  const [comments, setComments] = useState<ComicComment[]>([]);
  const [commentName, setCommentName] = useState("Bạn đọc");
  const [commentText, setCommentText] = useState("");
  const [selectedSticker, setSelectedSticker] = useState("");
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false);
  const [commentBusy, setCommentBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [readChapterSlugs, setReadChapterSlugs] = useState<Set<string>>(() => getReadChapterSet(source, slug));

  useEffect(() => {
    let ignore = false;
    const request = source === "otruyen" ? fetchOTruyenComic(slug) : source === "truyenqq" ? fetchTruyenQQComic(slug) : fetchComic(slug);
    request
      .then((data) => {
        if (!ignore) {
          setComic(data);
          setError("");
        }
      })
      .catch((error: Error) => {
        if (!ignore) setError(error.message);
      });
    return () => {
      ignore = true;
    };
  }, [slug, source]);

  useEffect(() => {
    const storedLastRead = readStoredJson<LastRead | null>(lastReadKey(source, slug), null);
    setLastRead(storedLastRead);
    // Check follow status from server user data stored in localStorage (updated on login/action)
    const storedUser = (() => { try { return JSON.parse(localStorage.getItem("auth_user") || "null"); } catch { return null; } })();
    if (storedUser?.comicFollows) {
      setFollowed(storedUser.comicFollows.some((f: any) => f.slug === slug && f.source === source));
    } else {
      setFollowed(localStorage.getItem(followKey(source, slug)) === "1");
    }
    setRating(Number(localStorage.getItem(ratingKey(source, slug)) || 0));
    const localComments = readStoredJson<ComicComment[]>(commentsKey(source, slug), []);
    setComments(localComments);
    fetchChapterComments({ source, comicSlug: slug, chapterSlug: COMIC_DETAIL_COMMENTS_CHAPTER })
      .then((data) => {
        if (data.comments?.length || !localComments.length) setComments(data.comments || []);
      })
      .catch(() => {
        setComments(localComments);
      });
    setCommentText("");
    setSelectedSticker("");
    setStickerPickerOpen(false);
    const nextReadSet = getReadChapterSet(source, slug);
    if (storedLastRead?.chapterSlug) nextReadSet.add(storedLastRead.chapterSlug);
    setReadChapterSlugs(nextReadSet);
  }, [slug, source]);

  useEffect(() => {
    const refresh = () => setReadChapterSlugs(getReadChapterSet(source, slug));
    refresh();
    const onRead = (event: Event) => {
      const detail = (event as CustomEvent<{ source: CatalogSource; slug: string }>).detail;
      if (!detail || (detail.source === source && detail.slug === slug)) refresh();
    };
    window.addEventListener("reader-chapter-read", onRead as EventListener);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("reader-chapter-read", onRead as EventListener);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [slug, source]);

  async function toggleFollow() {
    const next = !followed;
    setFollowed(next);
    // Keep localStorage as fallback for guests
    localStorage.setItem(followKey(source, slug), next ? "1" : "0");
    const token = localStorage.getItem("auth_token") || "";
    if (token && comic) {
      try {
        const res = await fetch("/api/user/comic-follows/toggle", {
          method: "POST",
          headers: { "content-type": "application/json", "authorization": `Bearer ${token}` },
          body: JSON.stringify({ slug: comic.slug, source, title: comic.title, cover: comic.cover })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.user) localStorage.setItem("auth_user", JSON.stringify(data.user));
        }
      } catch { /* ignore network errors, localStorage fallback active */ }
    } else if (next && comic) {
      localStorage.setItem(`comic-details:${source}:${slug}`, JSON.stringify({ title: comic.title, cover: comic.cover, slug: comic.slug, source }));
    } else {
      const lrk = `reader-last:${source}:${slug}`;
      if (!localStorage.getItem(lrk)) localStorage.removeItem(`comic-details:${source}:${slug}`);
    }
  }

  function rateComic(value: number) {
    setRating(value);
    localStorage.setItem(ratingKey(source, slug), String(value));
  }

  async function submitComment(reply?: ReplyTarget) {
    const text = commentText.trim();
    if ((!text && !selectedSticker) || commentBusy) return;
    const authUser = readAuthUserFromStorage();
    const role: ComicComment["role"] = authUser?.role === "admin" ? "admin" : "user";
    const authLevel = getReaderLevelInfo(readReaderXp(authUser), authUser?.role);
    const avatarFrame = readSelectedAvatarFrameId(authUser, authLevel.index);
    const nextComment: ComicComment = {
      id: crypto.randomUUID(),
      name: resolveCommentName(commentName, authUser),
      text,
      sticker: selectedSticker || undefined,
      avatar: authUser?.avatar,
      avatarFrame: avatarFrame !== AVATAR_FRAME_NONE ? avatarFrame : undefined,
      parentId: reply?.parentId,
      replyTo: reply?.replyTo,
      role,
      createdAt: new Date().toISOString()
    };
    setCommentBusy(true);
    try {
      const data = await postChapterComment({
        source,
        comicSlug: slug,
        chapterSlug: COMIC_DETAIL_COMMENTS_CHAPTER,
        name: nextComment.name,
        text,
        sticker: selectedSticker || undefined,
        avatar: authUser?.avatar,
        avatarFrame: avatarFrame !== AVATAR_FRAME_NONE ? avatarFrame : undefined,
        parentId: reply?.parentId,
        replyTo: reply?.replyTo
      });
      const next = data.comments || [];
      setComments(next);
      localStorage.setItem(commentsKey(source, slug), JSON.stringify(next));
      setCommentText("");
      setSelectedSticker("");
      setStickerPickerOpen(false);
    } catch {
      const next = [nextComment, ...comments].slice(0, 200);
      setComments(next);
      localStorage.setItem(commentsKey(source, slug), JSON.stringify(next));
      setCommentText("");
      setSelectedSticker("");
      setStickerPickerOpen(false);
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

  if (!comic) {
    return <main className="page loading-row">Đang tải...</main>;
  }

  const chaptersDesc = [...comic.chapters].sort((a, b) => b.number - a.number);
  const firstChapter = comic.chapters[0];
  const latestChapter = chaptersDesc[0];
  const canContinue = Boolean(lastRead && comic.chapters.some((chapter) => chapter.slug === lastRead.chapterSlug));

  return (
    <main className="page">
      <section className="detail-band">
        <OptimizedImage className="detail-cover" src={comic.cover} alt={comic.title} referrerPolicy="no-referrer" />
        <div className="detail-copy">
          <Link className="back-link" href="/">
            <ChevronLeft size={18} />
            <span>Kho truyện</span>
          </Link>
          <div className="detail-heading">
            <span className="status-pill">{STATUS_LABELS[comic.status]}</span>
            <h1>{comic.title}</h1>
          </div>
          <div className="comic-description-block">
            <p className={descriptionExpanded ? "expanded" : ""}>{comic.description}</p>
            {comic.description.length > 220 && (
              <button className="description-toggle" onClick={() => setDescriptionExpanded((value) => !value)}>
                {descriptionExpanded ? "Thu gọn" : "Xem thêm"}
              </button>
            )}
          </div>
          <div className="meta-grid">
            <MetaItem label="Tác giả" value={comic.author} />
            <MetaItem label="Lượt đọc" value={formatNumber(comic.views)} />
            <MetaItem label="Cập nhật" value={formatDate(comic.updatedAt)} />
            <MetaItem label="Số chương" value={`${comic.chapters.length}`} />
          </div>
          <div className="chip-row">
            {comic.genres.map((item) => (
              <button 
                className="chip strong clickable" 
                key={item} 
                onClick={() => {
                  if (onSelectGenre) {
                    const slug = getGenreSlug(item, source);
                    onSelectGenre(slug);
                  }
                }}
                style={{ cursor: "pointer", border: "none", outline: "none", background: "var(--surface-2)" }}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="action-row">
            {firstChapter && (
              <Link className="primary-action" href={readPath(source, comic.slug, firstChapter.slug)}>
                <BookOpen size={18} />
                <span>Đọc từ đầu</span>
              </Link>
            )}
            {canContinue && lastRead ? (
              <Link className="secondary-action" href={readPath(source, comic.slug, lastRead.chapterSlug)}>
                <ChevronRight size={18} />
                <span>Đọc tiếp {lastRead.chapterTitle}</span>
              </Link>
            ) : (
              <span className="secondary-action" style={{ opacity: 0.5, cursor: "not-allowed", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <ChevronRight size={18} />
                <span>Đọc tiếp</span>
              </span>
            )}
            {latestChapter && latestChapter.slug !== firstChapter?.slug && (
              <Link className="secondary-action" href={readPath(source, comic.slug, latestChapter.slug)}>
                <ChevronRight size={18} />
                <span>Chương mới</span>
              </Link>
            )}
            <button className={followed ? "secondary-action active-action" : "secondary-action"} onClick={toggleFollow}>
              <Heart size={18} />
              <span>{followed ? "Đang theo dõi" : "Theo dõi"}</span>
            </button>
          </div>
          <div className="rating-row" aria-label="Đánh giá truyện">
            <span>Đánh giá</span>
            {[1, 2, 3, 4, 5].map((value) => (
              <button key={value} className={value <= rating ? "selected" : ""} onClick={() => rateComic(value)} aria-label={`${value} sao`}>
                <Star size={18} fill="currentColor" />
              </button>
            ))}
            <strong>{rating ? `${rating}/5` : "Chưa đánh giá"}</strong>
          </div>
        </div>
      </section>

      <section className="chapter-section">
        <div className="section-title">
          <h2>Danh sách chương</h2>
          <span>{comic.chapters.length} chương</span>
        </div>
        <div className="chapter-table">
          <div className="chapter-table-header">
            <span>Số chương</span>
            <span>Cập nhật</span>
            <span>Lượt xem</span>
          </div>
          <div className="chapter-table-body">
            {(expanded ? chaptersDesc : chaptersDesc.slice(0, 15)).map((chapter) => (
              <Link key={chapter.id} className={readChapterSlugs.has(chapter.slug) ? "chapter-table-row is-read" : "chapter-table-row"} href={readPath(source, comic.slug, chapter.slug)}>
                <span>{chapter.title}</span>
                <span>{formatDate(chapter.createdAt)}</span>
                <span>{formatNumber(Math.floor((comic.views || 1000) / (chapter.number || 1) + 12))}</span>
              </Link>
            ))}
          </div>
        </div>
        {!expanded && chaptersDesc.length > 15 && (
          <button 
            className="primary-action wide" 
            onClick={() => setExpanded(true)} 
            style={{ marginTop: "16px", background: "var(--surface-2)", color: "var(--ink)", border: "1px solid var(--line)", padding: "12px", width: "100%", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}
          >
            + Xem thêm
          </button>
        )}
      </section>

      <section className="comment-section">
        <QQCommentPanel
          comments={comments}
          commentName={commentName}
          commentText={commentText}
          selectedSticker={selectedSticker}
          stickerPickerOpen={stickerPickerOpen}
          busy={commentBusy}
          emptyMessage="Chưa có bình luận nào."
          reactionScope={commentsKey(source, slug)}
          onNameChange={setCommentName}
          onTextChange={setCommentText}
          onStickerChange={setSelectedSticker}
          onPickerToggle={setStickerPickerOpen}
          onSubmit={submitComment}
        />
      </section>
    </main>
  );
}
