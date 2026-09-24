import { Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { MovieSummary } from "../../types";
import { OptimizedImage } from "../common/OptimizedImage";

export function FeaturedMovie({ movie }: { movie: MovieSummary }) {
  const path = `#/movie/${movie.slug}`;
  return (
    <article className="featured movie-featured">
      <a href={path} style={{ display: "block" }}>
        <OptimizedImage src={movie.thumb || movie.poster} alt={movie.title} priority referrerPolicy={undefined} />
      </a>
      <div>
        <span className="status-pill">{movie.year || "Mới"}</span>
        <a href={path} style={{ textDecoration: "none", color: "inherit" }}>
          <h2>{movie.title}</h2>
        </a>
        <p>{movie.originTitle || "Đang cập nhật tên gốc"}</p>
        <a href={path} className="text-action" style={{ textDecoration: "none" }}>
          <Play size={17} />
          <span>Xem ngay</span>
        </a>
      </div>
    </article>
  );
}

export function MovieCard({ movie }: { movie: MovieSummary }) {
  const path = `#/movie/${movie.slug}`;
  return (
    <article className="movie-card">
      <a href={path} className="movie-poster" aria-label={`Mở ${movie.title}`} style={{ display: "block" }}>
        <OptimizedImage src={movie.thumb || movie.poster} alt={movie.title} />
        <span>
          <Play size={18} />
        </span>
      </a>
      <div className="movie-card-body">
        <a href={path} style={{ textDecoration: "none", color: "inherit" }}>
          <h3 className="movie-title">{movie.title}</h3>
        </a>
        <p>{movie.originTitle || "Đang cập nhật"}</p>
        <div className="movie-meta-row">
          <span>{movie.year || "N/A"}</span>
          <span>{movie.rating ? movie.rating.toFixed(1) : "Mới"}</span>
        </div>
      </div>
    </article>
  );
}

export function MovieStreamPlayer({ embedUrl, streamUrl, title }: { embedUrl?: string; streamUrl?: string; title: string }) {
  const shellRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const useDirectVideo = Boolean(streamUrl && !embedUrl);

  useEffect(() => {
    setIframeLoaded(false);
    setVideoLoaded(false);
  }, [embedUrl, streamUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl || !useDirectVideo) return;
    let cancelled = false;
    let hlsInstance: { destroy: () => void } | null = null;

    video.pause();
    video.removeAttribute("src");
    video.load();

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = streamUrl;
      video.load();
      return;
    }

    import("hls.js")
      .then(({ default: Hls }) => {
        if (cancelled || !video) return;
        if (Hls.isSupported()) {
          const hls = new Hls({
            capLevelToPlayerSize: true,
            maxBufferLength: 24,
            backBufferLength: 20
          });
          hlsInstance = hls;
          hls.loadSource(streamUrl);
          hls.attachMedia(video);
        } else {
          video.src = streamUrl;
          video.load();
        }
      })
      .catch(() => {
        if (!cancelled && video) {
          video.src = streamUrl;
          video.load();
        }
      });

    return () => {
      cancelled = true;
      hlsInstance?.destroy();
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [streamUrl, useDirectVideo]);

  const toggleFullscreen = () => {
    const el = shellRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      el.requestFullscreen?.().catch(() => {});
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement | null;
      const tag = el?.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || el?.isContentEditable) return;
      const key = event.key.toLowerCase();
      if (key === "f") {
        event.preventDefault();
        toggleFullscreen();
      } else if (useDirectVideo && event.code === "Space") {
        const video = videoRef.current;
        if (!video) return;
        event.preventDefault();
        if (video.paused) video.play().catch(() => {});
        else video.pause();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [useDirectVideo]);

  const handleIframeLoad = () => {
    window.setTimeout(() => setIframeLoaded(true), 250);
  };

  return (
    <div ref={shellRef} className={useDirectVideo ? "movie-player-shell direct-movie-player" : "movie-player-shell iframe-movie-player"}>
      {useDirectVideo && (
        <>
          <video
            ref={videoRef}
            title={title}
            controls
            playsInline
            preload="metadata"
            onCanPlay={() => setVideoLoaded(true)}
            onLoadedMetadata={() => setVideoLoaded(true)}
          />
          {!videoLoaded && <div className="iframe-load-ring" aria-label="Đang tải phim" />}
        </>
      )}
      {!useDirectVideo && embedUrl && (
        <iframe
          src={embedUrl}
          title={title}
          allow="autoplay; fullscreen *; picture-in-picture"
          allowFullScreen
          sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
          referrerPolicy="no-referrer"
          onLoad={handleIframeLoad}
        />
      )}
      {!useDirectVideo && !iframeLoaded && (
        <div className="iframe-load-ring" aria-label="Đang tải phim" />
      )}
    </div>
  );
}
