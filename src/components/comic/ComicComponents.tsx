import { BookOpen, MessageCircle, Send, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { COMMENT_STICKERS, STATUS_LABELS } from "../../constants/comic";
import type { CatalogSource, ComicSummary, DisplayComment, ReplyTarget } from "../../types";
import {
  getAvatarFrameById,
  getReaderLevel,
  getReaderLevelInfo,
  isImageSticker,
  isSameCommentUser,
  readAuthUserFromStorage,
  readReaderXp,
  readSelectedAvatarFrameId
} from "../../utils/helpers";
import { comicPath, formatDateTime, readPath, readStoredJson } from "../../utils/routing";
import { AvatarFrameBox } from "../common/AvatarFrameBox";
import { OptimizedImage } from "../common/OptimizedImage";
import { Link } from "../common/UIComponents";

export function FeaturedComic({ comic, source }: { comic: ComicSummary; source: CatalogSource }) {
  return (
    <article className="featured">
      <Link href={comicPath(source, comic.slug)} style={{ display: "block" }}>
        <OptimizedImage src={comic.cover} alt={comic.title} referrerPolicy="no-referrer" priority />
      </Link>
      <div>
        <span className="status-pill">{STATUS_LABELS[comic.status]}</span>
        <Link className="comic-title-btn" href={comicPath(source, comic.slug)} style={{ textDecoration: "none" }}>
          <h2>{comic.title}</h2>
        </Link>
        <p>{comic.description}</p>
        {comic.latestChapter && (
          <Link className="text-action" href={readPath(source, comic.slug, comic.latestChapter?.slug || "")}>
            <BookOpen size={17} />
            <span>{comic.latestChapter.title}</span>
          </Link>
        )}
      </div>
    </article>
  );
}

export function ComicCard({ comic, source }: { comic: ComicSummary; source: CatalogSource }) {
  return (
    <article className="comic-card">
      <Link className="cover-button" href={comicPath(source, comic.slug)} ariaLabel={`Mở ${comic.title}`}>
        <OptimizedImage src={comic.cover} alt={comic.title} referrerPolicy="no-referrer" />
      </Link>
      <div className="comic-card-body">
        <div className="card-title-row">
          <Link href={comicPath(source, comic.slug)} style={{ textDecoration: "none", color: "inherit", flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{comic.title}</h3>
          </Link>
          <span>{comic.rating ? comic.rating.toFixed(1) : "Mới"}</span>
        </div>
        <p>{comic.description}</p>
        <div className="chip-row">
          {comic.genres.slice(0, 3).map((item) => (
            <span className="chip" key={item}>
              {item}
            </span>
          ))}
        </div>
        <div className="card-footer">
          <span>{comic.totalChapters} chương</span>
          {comic.latestChapter && (
            <Link href={readPath(source, comic.slug, comic.latestChapter?.slug || "")} style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "var(--surface-2)", border: "1px solid var(--line)", padding: "6px 12px", borderRadius: "6px", color: "var(--ink)", fontWeight: "bold", fontSize: "0.82rem" }}>
              <BookOpen size={16} />
              <span>Đọc</span>
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

export function QQCommentPanel({
  comments,
  commentName,
  commentText,
  selectedSticker,
  stickerPickerOpen,
  busy,
  emptyMessage,
  reactionScope,
  onNameChange,
  onTextChange,
  onStickerChange,
  onPickerToggle,
  onSubmit
}: {
  comments: DisplayComment[];
  commentName: string;
  commentText: string;
  selectedSticker: string;
  stickerPickerOpen: boolean;
  busy?: boolean;
  emptyMessage: string;
  reactionScope: string;
  onNameChange: (value: string) => void;
  onTextChange: (value: string) => void;
  onStickerChange: (value: string) => void;
  onPickerToggle: (value: boolean) => void;
  onSubmit: (reply?: ReplyTarget) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [replyingTo, setReplyingTo] = useState<ReplyTarget | null>(null);
  const [reactions, setReactions] = useState<Record<string, "like" | "dislike">>({});
  const reactionKey = `comment-reactions:${reactionScope}`;
  const currentAuthUser = readAuthUserFromStorage();

  const { topLevelComments, repliesByParent } = useMemo(() => {
    const commentIds = new Set(comments.map((comment) => comment.id));
    const nextTopLevel: DisplayComment[] = [];
    const nextReplies = new Map<string, DisplayComment[]>();

    for (const comment of comments) {
      const parentId = comment.parentId && commentIds.has(comment.parentId) ? comment.parentId : "";
      if (!parentId) {
        nextTopLevel.push(comment);
        continue;
      }

      const group = nextReplies.get(parentId) || [];
      group.push(comment);
      nextReplies.set(parentId, group);
    }

    return { topLevelComments: nextTopLevel, repliesByParent: nextReplies };
  }, [comments]);

  useEffect(() => {
    setReactions(readStoredJson<Record<string, "like" | "dislike">>(reactionKey, {}));
  }, [reactionKey]);

  const saveReaction = (commentId: string, value: "like" | "dislike") => {
    setReactions((current) => {
      const next = { ...current };
      if (next[commentId] === value) delete next[commentId];
      else next[commentId] = value;
      localStorage.setItem(reactionKey, JSON.stringify(next));
      return next;
    });
  };

  const handleReply = (comment: DisplayComment) => {
    const name = comment.name.trim() || "Bạn đọc";
    const parentId = comment.parentId && comments.some((item) => item.id === comment.parentId) ? comment.parentId : comment.id;
    setReplyingTo({ parentId, replyTo: name });
    onPickerToggle(false);
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const cancelReply = () => {
    setReplyingTo(null);
  };

  const handleSubmit = () => {
    if (!commentText.trim() && !selectedSticker) return;
    onSubmit(replyingTo || undefined);
    setReplyingTo(null);
  };

  const renderComment = (comment: DisplayComment, isReply = false) => {
    const level = getReaderLevel(comment, comments);
    const ledClass = `led-${level.index % 5}`;
    const avatarSrc = comment.avatar || (isSameCommentUser(comment, currentAuthUser) ? currentAuthUser?.avatar : "");
    const currentLevel = getReaderLevelInfo(readReaderXp(currentAuthUser), currentAuthUser?.role);
    const fallbackFrameId = isSameCommentUser(comment, currentAuthUser) ? readSelectedAvatarFrameId(currentAuthUser, currentLevel.index) : "none";
    const avatarFrame = getAvatarFrameById(comment.avatarFrame || fallbackFrameId);
    return (
      <article key={comment.id} className={`qq-comment-item${isReply ? " is-reply" : ""}`}>
        <AvatarFrameBox frame={avatarFrame} className="qq-comment-avatar">
          {avatarSrc
            ? <OptimizedImage src={avatarSrc} alt={comment.name} />
            : <span>{comment.name.trim().charAt(0).toUpperCase() || "B"}</span>}
        </AvatarFrameBox>
        <div className="qq-comment-body">
          <div className="qq-comment-author">
            <strong className={`reader-name level-name-${level.index} ${ledClass}`}>{comment.name}</strong>
            <span className={`reader-level-badge level-badge-${level.index}`}>{level.label}</span>
          </div>
          <div className="qq-comment-line" />
          {comment.text && (
            <p>
              {isReply && comment.replyTo && <span className="qq-reply-prefix">@{comment.replyTo}</span>}
              {comment.text}
            </p>
          )}
          {comment.sticker && (
            <div className="qq-comment-sticker">
              {isImageSticker(comment.sticker) ? <img src={comment.sticker} alt="Sticker" /> : <span>{comment.sticker}</span>}
            </div>
          )}
          <div className="qq-comment-tools">
            <button
              type="button"
              className={`qq-reaction-btn${reactions[comment.id] === "like" ? " active" : ""}`}
              onClick={() => saveReaction(comment.id, "like")}
              aria-label="Thích bình luận"
            >
              <ThumbsUp size={14} />
              <span>{reactions[comment.id] === "like" ? 1 : 0}</span>
            </button>
            <button
              type="button"
              className={`qq-reaction-btn${reactions[comment.id] === "dislike" ? " active dislike" : ""}`}
              onClick={() => saveReaction(comment.id, "dislike")}
              aria-label="Không thích bình luận"
            >
              <ThumbsDown size={14} />
              <span>{reactions[comment.id] === "dislike" ? 1 : 0}</span>
            </button>
            <button type="button" className="qq-reply-btn" onClick={() => handleReply(comment)}>Trả lời</button>
            <span>{formatDateTime(comment.createdAt)}</span>
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="reader-tab-content reader-chapter-comments qq-comment-box">
      <div className="qq-comment-title">
        <MessageCircle size={20} />
        <span>Bình Luận ({comments.length})</span>
      </div>
      <p className="qq-comment-note">Vào Fanpage like và theo dõi để ủng hộ TPM nhé.</p>
      <input className="qq-comment-name" value={commentName} onChange={(event) => onNameChange(event.target.value)} placeholder="Tên hiển thị" />
      {replyingTo && (
        <div className="qq-reply-target">
          <span>Đang trả lời <strong>@{replyingTo.replyTo}</strong></span>
          <button type="button" onClick={cancelReply} aria-label="Hủy trả lời"><X size={14} /></button>
        </div>
      )}
      <div className="qq-editor-shell">
        <textarea
          ref={textareaRef}
          className="qq-comment-textarea"
          value={commentText}
          onFocus={() => onPickerToggle(true)}
          onChange={(event) => onTextChange(event.target.value)}
          placeholder="Mời bạn thảo luận, hãy bình luận có văn hóa để tránh bị khóa tài khoản"
        />
        {selectedSticker && (
          <button className="qq-sticker-in-editor" type="button" onClick={() => onStickerChange("")} title="Bỏ sticker đã chọn">
            {isImageSticker(selectedSticker) ? <img src={selectedSticker} alt="Sticker đã chọn" /> : <span>{selectedSticker}</span>}
            <X size={14} />
          </button>
        )}
      </div>
      <div className="qq-sticker-toolbar">
        {COMMENT_STICKERS.map((sticker) => (
          <button key={sticker.id} type="button" className={selectedSticker === sticker.src ? "selected" : ""} onClick={() => { onStickerChange(sticker.src); onPickerToggle(true); }}>
            <img src={sticker.src} alt="Sticker" />
          </button>
        ))}
      </div>
      {stickerPickerOpen && (
        <div className="qq-sticker-picker">
          {COMMENT_STICKERS.map((sticker) => (
            <button key={sticker.id} type="button" className={selectedSticker === sticker.src ? "selected" : ""} onClick={() => onStickerChange(sticker.src)}>
              <img src={sticker.src} alt="Sticker" />
            </button>
          ))}
        </div>
      )}
      <div className="qq-comment-actions">
        <button className="primary-action" onClick={handleSubmit} disabled={busy || (!commentText.trim() && !selectedSticker)}>
          <Send size={18} />
          <span>{busy ? "Đang gửi..." : "Gửi bình luận"}</span>
        </button>
      </div>
      <div className="qq-comment-list">
        {comments.length ? (
          topLevelComments.map((comment) => {
            const replies = repliesByParent.get(comment.id) || [];
            return (
              <div key={comment.id} className="qq-comment-thread">
                {renderComment(comment)}
                {replies.length > 0 && (
                  <div className="qq-comment-replies">
                    {replies.map((reply) => renderComment(reply, true))}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="loading-row">{emptyMessage}</div>
        )}
      </div>
    </div>
  );
}
