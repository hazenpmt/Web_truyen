import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Eye,
  Film,
  Heart,
  Layers3,
  Menu,
  MessageCircle,
  Play,
  Plus,
  Search,
  Send,
  Star
} from "lucide-react";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { fetchMovie } from "../api";
import { OptimizedImage } from "../components/common/OptimizedImage";
import { Link, MetaItem, Notice } from "../components/common/UIComponents";
import { MovieStreamPlayer } from "../components/movie/MovieComponents";
import type { AuthUser, MovieDetail, MovieEpisode } from "../types";
import { navigate } from "../utils/routing";

export function MovieDetailViewV2({
  slug,
  episodeSlug,
  authUser,
  onUpdateUser,
  onSelectCategory
}: {
  slug: string;
  episodeSlug?: string;
  authUser: AuthUser | null;
  onUpdateUser: (user: AuthUser) => void;
  onSelectCategory?: (category: string | null, country: string | null) => void;
}) {
  const [movie, setMovie] = useState<MovieDetail | null>(null);
  const [error, setError] = useState("");
  const [selectedServer, setSelectedServer] = useState(0);
  const [episodeGroup, setEpisodeGroup] = useState(0);
  const [compactEpisodes, setCompactEpisodes] = useState(true);
  const [playerReady, setPlayerReady] = useState(Boolean(episodeSlug));

  useEffect(() => {
    let ignore = false;
    fetchMovie(slug)
      .then((data) => {
        if (ignore) return;
        const savedServer = Number(localStorage.getItem(`movie-server:${slug}`));
        const maxServer = Math.max((data.episodes?.length ?? 1) - 1, 0);
        setMovie(data);
        setError("");
        setSelectedServer(Number.isFinite(savedServer) ? Math.min(Math.max(savedServer, 0), maxServer) : 0);
        setEpisodeGroup(0);
      })
      .catch((err: Error) => {
        if (!ignore) setError(err.message);
      });
    return () => {
      ignore = true;
    };
  }, [slug]);

  useEffect(() => {
    setPlayerReady(Boolean(episodeSlug));
  }, [episodeSlug, slug]);

  const isFavorited = useMemo(() => {
    return authUser?.favorites?.some((fav) => fav.slug === slug) || false;
  }, [authUser, slug]);

  const servers = movie?.episodes ?? [];
  const activeServerIndex = servers.length ? Math.min(selectedServer, servers.length - 1) : 0;
  const currentServerEpisodes = useMemo(() => {
    return servers[activeServerIndex]?.episodes ?? [];
  }, [servers, activeServerIndex]);

  const selectedEpisode = useMemo(() => {
    if (!currentServerEpisodes.length) return undefined;
    return (
      currentServerEpisodes.find((episode) => episode.slug === episodeSlug) ||
      currentServerEpisodes.find((episode) => episode.embedUrl || episode.streamUrl) ||
      currentServerEpisodes[0]
    );
  }, [currentServerEpisodes, episodeSlug]);

  const firstPlayableEpisode = useMemo(() => {
    return currentServerEpisodes.find((episode) => episode.embedUrl || episode.streamUrl) || currentServerEpisodes[0];
  }, [currentServerEpisodes]);

  const episodeGroups = useMemo(() => {
    const size = 100;
    const groups: Array<{ start: number; end: number; episodes: MovieEpisode[] }> = [];
    for (let index = 0; index < currentServerEpisodes.length; index += size) {
      groups.push({
        start: index + 1,
        end: Math.min(index + size, currentServerEpisodes.length),
        episodes: currentServerEpisodes.slice(index, index + size)
      });
    }
    return groups;
  }, [currentServerEpisodes]);

  useEffect(() => {
    setEpisodeGroup(0);
  }, [activeServerIndex, slug]);

  useEffect(() => {
    if (!episodeSlug || !currentServerEpisodes.length) return;
    const index = currentServerEpisodes.findIndex((episode) => episode.slug === episodeSlug);
    if (index >= 0) setEpisodeGroup(Math.floor(index / 100));
  }, [episodeSlug, currentServerEpisodes]);

  useEffect(() => {
    if (!authUser || !movie || !selectedEpisode || !playerReady) return;
    let ignore = false;
    const saveHistory = async () => {
      try {
        const res = await fetch("/api/user/history", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "authorization": `Bearer ${localStorage.getItem("auth_token") || ""}`
          },
          body: JSON.stringify({
            slug: movie.slug,
            title: movie.title,
            poster: movie.poster,
            episodeSlug: selectedEpisode.slug,
            episodeName: selectedEpisode.name
          })
        });
        const data = await res.json();
        if (!ignore && res.ok && data.user) onUpdateUser(data.user);
      } catch (err) {
        console.error("Save movie history failed:", err);
      }
    };
    saveHistory();
    return () => {
      ignore = true;
    };
  }, [authUser?.id, movie?.slug, selectedEpisode?.slug, playerReady]);

  const toggleMovieFavorite = async () => {
    if (!authUser || !movie) return;
    try {
      const res = await fetch("/api/user/favorites/toggle", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "authorization": `Bearer ${localStorage.getItem("auth_token") || ""}`
        },
        body: JSON.stringify({
          type: "movie",
          movie: {
            slug: movie.slug,
            title: movie.title,
            poster: movie.poster
          }
        })
      });
      const data = await res.json();
      if (res.ok && data.user) onUpdateUser(data.user);
    } catch (err) {
      console.error(err);
    }
  };

  const prettyServer = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes("thuy") || lower.includes("minh")) return "Thuyết minh";
    if (lower.includes("vietsub")) return "Vietsub";
    if (lower.includes("long") || lower.includes("lồng")) return "Lồng tiếng";
    return name.replace(/^#+\s*/, "").replace(/\s+/g, " ").replace(/hà nội/gi, "").replace(/[()]/g, "").trim() || "Server";
  };

  const detectQuality = (filename: string): string | null => {
    const lower = filename.toLowerCase();
    if (lower.includes("4k") || lower.includes("2160p")) return "4K";
    if (lower.includes("1080p") || lower.includes("fhd") || lower.includes("full hd")) return "FHD";
    if (lower.includes("720p") || lower.includes("hd")) return "HD";
    if (lower.includes("480p") || lower.includes("sd")) return "SD";
    return null;
  };

  if (error) {
    return (
      <main className="page">
        <Notice tone="error" message={error} />
      </main>
    );
  }

  if (!movie) {
    return <main className="page loading-row">Đang tải...</main>;
  }

  const isWatchMode = Boolean(episodeSlug);
  const canPlaySelectedEpisode = Boolean(selectedEpisode?.embedUrl || selectedEpisode?.streamUrl);
  const selectedRangeIndex = Math.min(episodeGroup, Math.max(episodeGroups.length - 1, 0));
  const selectedRange = episodeGroups[selectedRangeIndex];
  const rangeEpisodes = selectedRange?.episodes ?? currentServerEpisodes;
  const visibleEpisodes = compactEpisodes ? rangeEpisodes.slice(0, isWatchMode ? 30 : 48) : rangeEpisodes;
  const hasHiddenEpisodes = visibleEpisodes.length < rangeEpisodes.length;
  const movieTags = [...movie.categories, ...movie.countries].filter(Boolean).slice(0, 8);
  const backdropImage = movie.thumb || movie.poster;

  const selectServer = (index: number) => {
    setSelectedServer(index);
    localStorage.setItem(`movie-server:${slug}`, String(index));
    setPlayerReady(Boolean(episodeSlug));
  };

  const openFirstEpisode = () => {
    if (!firstPlayableEpisode) return;
    setPlayerReady(true);
    navigate(`/movie/${movie.slug}/${firstPlayableEpisode.slug}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const renderEpisodeBrowser = (variant: "detail" | "watch") => (
    <div className={`rophim-episodes rophim-episodes-${variant}`}>
      <div className="rophim-episode-heading">
        <div className="rophim-part-title">
          <Menu size={22} />
          <span>Phần 1</span>
          <ChevronRight size={16} />
        </div>
        <label className="rophim-compact-toggle">
          <span>Rút gọn</span>
          <input
            type="checkbox"
            checked={compactEpisodes}
            onChange={(event) => setCompactEpisodes(event.target.checked)}
          />
          <i />
        </label>
      </div>

      {servers.length > 0 && (
        <div className="rophim-server-tabs">
          {servers.map((server, index) => (
            <button
              key={`${server.serverName}-${index}`}
              className={index === activeServerIndex ? "active" : ""}
              onClick={() => selectServer(index)}
            >
              <Clapperboard size={13} />
              <span>{prettyServer(server.serverName)}</span>
            </button>
          ))}
        </div>
      )}

      {episodeGroups.length > 1 && (
        <div className="rophim-range-tabs">
          {episodeGroups.map((group, index) => (
            <button
              key={`${group.start}-${group.end}`}
              className={index === selectedRangeIndex ? "active" : ""}
              onClick={() => setEpisodeGroup(index)}
            >
              Tập {group.start} - {group.end}
            </button>
          ))}
        </div>
      )}

      <div className="rophim-episode-grid">
        {visibleEpisodes.map((episode) => (
          <Link
            key={`${activeServerIndex}-${episode.slug}`}
            className={`rophim-episode-btn${episode.slug === selectedEpisode?.slug ? " active" : ""}`}
            href={`/movie/${movie.slug}/${episode.slug}`}
            onClick={() => {
              setPlayerReady(true);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            <Play size={14} fill="currentColor" />
            <span>{episode.name}</span>
            {detectQuality(episode.filename) && <b>{detectQuality(episode.filename)}</b>}
          </Link>
        ))}
      </div>

      {hasHiddenEpisodes && (
        <button className="rophim-show-more" onClick={() => setCompactEpisodes(false)}>
          Hiện thêm tập
        </button>
      )}
    </div>
  );

  if (isWatchMode) {
    return (
      <main className="movie-detail rophim-watch-page">
        <section className="rophim-watch-player">
          {canPlaySelectedEpisode && selectedEpisode ? (
            <MovieStreamPlayer
              embedUrl={selectedEpisode.embedUrl}
              streamUrl={selectedEpisode.streamUrl}
              title={`${movie.title} - ${selectedEpisode.name}`}
            />
          ) : (
            <div className="movie-player-shell">
              <div className="empty-player">Tập này chưa có link phát.</div>
            </div>
          )}
        </section>

        <section className="rophim-watch-tools">
          <button onClick={toggleMovieFavorite} className={isFavorited ? "active" : ""}>
            <Heart size={18} fill={isFavorited ? "currentColor" : "none"} />
          </button>
          <button><Plus size={19} /></button>
          <button><Send size={18} /></button>
          <button><MessageCircle size={18} /></button>
          <button><Star size={18} /></button>
        </section>

        <section className="rophim-watch-content">
          <button className="rophim-back-title" onClick={() => navigate(`/movie/${movie.slug}`)}>
            <ChevronLeft size={18} />
            <span>Xem phim {movie.title}</span>
          </button>
          {renderEpisodeBrowser("watch")}
        </section>
      </main>
    );
  }

  return (
    <main className="movie-detail rophim-detail-page">
      <section className="rophim-hero" style={{ "--movie-backdrop": `url("${backdropImage}")` } as CSSProperties}>
        <div className="rophim-detail-card">
          <aside className="rophim-movie-side">
            <OptimizedImage className="rophim-detail-poster" src={movie.poster} alt={movie.title} />
            <h1>{movie.title}</h1>
            {movie.originTitle && <p>{movie.originTitle}</p>}
            <button className="rophim-mobile-info">Thông tin phim <ChevronRight size={15} /></button>
            <div className="rophim-score-row">
              <span>IMDb {movie.rating ? movie.rating.toFixed(1) : "0.0"}</span>
              {movie.year && <span>{movie.year}</span>}
              {movie.episodeCurrent && <span>{movie.episodeCurrent}</span>}
            </div>
            <div className="rophim-tag-row">
              {movieTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => {
                    if (!onSelectCategory) return;
                    if (movie.countries.includes(tag)) onSelectCategory(null, tag);
                    else onSelectCategory(tag, null);
                  }}
                >
                  {tag}
                </button>
              ))}
            </div>
            <div className="rophim-airing">
              Đã chiếu: {movie.episodeCurrent || movie.status || "Đang cập nhật"}
            </div>
            <h2>Giới thiệu:</h2>
            <p className="rophim-description">{movie.description}</p>
            {movie.duration && <p className="rophim-duration"><b>Thời lượng:</b> {movie.duration}</p>}
          </aside>

          <div className="rophim-main-panel">
            <div className="rophim-action-row">
              <button className="rophim-watch-now" onClick={openFirstEpisode} disabled={!firstPlayableEpisode}>
                <Play size={18} fill="currentColor" />
                <span>Xem Ngay</span>
              </button>
              <button onClick={toggleMovieFavorite} className={isFavorited ? "active" : ""}>
                <Heart size={18} fill={isFavorited ? "currentColor" : "none"} />
                <span>Yêu thích</span>
              </button>
              <button>
                <Plus size={18} />
                <span>Thêm vào</span>
              </button>
              <button>
                <Send size={18} />
                <span>Chia sẻ</span>
              </button>
              <button>
                <MessageCircle size={18} />
                <span>Bình luận</span>
              </button>
              <div className="rophim-rating-pill">
                <Star size={18} fill="currentColor" />
                <b>{movie.rating ? movie.rating.toFixed(1) : "0"}</b>
                <span>Đánh giá</span>
              </div>
            </div>

            <div className="rophim-tabs">
              <button className="active">Tập phim</button>
              <button>Gallery</button>
              <button>Diễn viên</button>
              <button>Đề xuất</button>
            </div>

            {renderEpisodeBrowser("detail")}
          </div>
        </div>
      </section>
    </main>
  );
}
