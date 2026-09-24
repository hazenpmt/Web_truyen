import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fetchMovies } from "../api";
import { OptimizedImage } from "../components/common/OptimizedImage";
import { Metric, Notice, PaginationControls } from "../components/common/UIComponents";
import { FeaturedMovie, MovieCard } from "../components/movie/MovieComponents";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useIsMobile } from "../hooks/useIsMobile";
import { usePageVisible } from "../hooks/usePageVisible";
import type { MovieSummary } from "../types";
import { formatNumber } from "../utils/routing";

export function MovieCatalogView({
  search,
  setSearch,
  type,
  setType
}: {
  search: string;
  setSearch: (s: string) => void;
  type: string;
  setType: (t: string) => void;
}) {
  const isMobile = useIsMobile();
  const pageVisible = usePageVisible();
  const debouncedSearch = useDebouncedValue(search, 350);
  const pageLimit = isMobile ? 8 : 16;
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [movies, setMovies] = useState<MovieSummary[]>([]);
  const [rankingMovies, setRankingMovies] = useState<MovieSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [triggerReload, setTriggerReload] = useState(0);

  useEffect(() => {
    if (isMobile) {
      setRankingMovies([]);
      return;
    }
    fetchMovies({ page: 1, limit: 8 })
      .then(payload => setRankingMovies(payload.items.slice(0, 8)))
      .catch(() => {});
  }, [triggerReload, isMobile]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, type, pageLimit]);

  useEffect(() => {
    let ignore = false;
    if (triggerReload === 0) setLoading(true);
    fetchMovies({ search: debouncedSearch, type, page, limit: pageLimit })
      .then((payload) => {
        if (!ignore) {
          setMovies(payload.items);
          setTotalItems(payload.pagination.totalItems);
          setTotalPages(payload.pagination.totalPages);
          setError("");
        }
      })
      .catch((error: Error) => {
        if (!ignore) setError(error.message);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [debouncedSearch, type, page, pageLimit, triggerReload]);

  useEffect(() => {
    if (isMobile || !pageVisible) return;
    const interval = setInterval(() => {
      setTriggerReload((prev) => prev + 1);
    }, 120000);
    return () => clearInterval(interval);
  }, [isMobile, pageVisible]);

  const featured = movies[0];

  return (
    <main className="page movie-page">
      <section className="catalog-band movie-band">
        <div className="catalog-intro">
          <p className="eyebrow">Kho phim</p>
          <h1>Xem phim chất lượng cao tại TPMphim</h1>
          <div className="metric-row">
            <Metric value={formatNumber(totalItems)} label="Tổng phim" />
            <Metric value={formatNumber(movies.length)} label="Đang hiện" />
            <Metric value={`${page}/${totalPages}`} label="Trang" />
          </div>
        </div>
        {featured && <FeaturedMovie movie={featured} />}
      </section>

      <section className="toolbar movie-toolbar" aria-label="Bộ lọc phim">
        <label className="search-box">
          <Search size={18} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm phim, tên gốc" />
        </label>
        <div className="segment" role="group" aria-label="Loại phim">
          <button className={!type ? "selected" : ""} onClick={() => setType("")}>
            Mới cập nhật
          </button>
          <button className={type === "series" ? "selected" : ""} onClick={() => setType("series")}>
            Phim bộ
          </button>
          <button className={type === "single" ? "selected" : ""} onClick={() => setType("single")}>
            Phim lẻ
          </button>
        </div>
      </section>

      {error && <Notice tone="error" message={error} />}
      {loading ? (
        <div className="loading-row">Đang tải...</div>
      ) : movies.length > 0 ? (
        <MoviePortalLayout movies={movies} rankingMovies={rankingMovies} isFiltered={!!(debouncedSearch || type)} />
      ) : (
        <div className="loading-row" style={{ textAlign: "center", padding: "40px" }}>
          Không tìm thấy phim nào.
        </div>
      )}

      {totalPages > 1 && (
        <PaginationControls page={page} totalPages={totalPages} totalItems={totalItems} onPageChange={setPage} />
      )}
    </main>
  );
}

export function MoviePortalLayout({ movies, rankingMovies, isFiltered }: { movies: MovieSummary[]; rankingMovies: MovieSummary[]; isFiltered: boolean }) {
  const isMobile = useIsMobile();
  const hotMovies = isFiltered ? [] : movies.slice(0, isMobile ? 4 : 6);
  const latestMovies = movies;
  const [rankingTab, setRankingTab] = useState<"day" | "week" | "month">("day");
  const [hotPage, setHotPage] = useState(0);

  const stableRanking = rankingMovies.length > 0 ? rankingMovies : movies.slice(0, 10);
  const rankedMovies = useMemo(() => {
    if (rankingTab === "week") return [...stableRanking].reverse();
    if (rankingTab === "month") return [...stableRanking].slice(0, 10);
    return [...stableRanking].slice(0, 10);
  }, [stableRanking, rankingTab]);

  return (
    <section className="movie-portal-layout" style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 360px", gap: isMobile ? "18px" : "28px" }}>
      <div className="portal-main">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--gold, #f59e0b)" }}>Phim hot nổi bật</h2>
            <span style={{ background: "var(--coral)", color: "#fff", padding: "2px 8px", borderRadius: "4px", fontSize: "0.8rem", fontWeight: "bold" }}>HOT</span>
          </div>
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              onClick={() => setHotPage(p => Math.max(0, p - 1))}
              disabled={hotPage === 0}
              style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid var(--line)", background: "var(--surface-2)", color: hotPage === 0 ? "var(--muted)" : "var(--ink)", cursor: hotPage === 0 ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" }}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setHotPage(p => Math.min(Math.ceil(hotMovies.length / 6) - 1, p + 1))}
              disabled={hotPage >= Math.ceil(hotMovies.length / 6) - 1}
              style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid var(--line)", background: "var(--surface-2)", color: hotPage >= Math.ceil(hotMovies.length / 6) - 1 ? "var(--muted)" : "var(--ink)", cursor: hotPage >= Math.ceil(hotMovies.length / 6) - 1 ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <div className="portal-hot-grid">
          {hotMovies.slice(hotPage * 6, hotPage * 6 + 6).map((movie) => {
            const path = `#/movie/${movie.slug}`;
            return (
              <article key={movie.id} className="portal-hot-card" style={{ display: "flex", flexDirection: "column" }}>
                <a
                  href={path}
                  style={{ position: "relative", display: "block", width: "100%", aspectRatio: "2/3", overflow: "hidden", borderRadius: "10px", border: "none", background: "#111", padding: 0 }}
                >
                  <OptimizedImage
                    src={movie.thumb || movie.poster}
                    alt={movie.title}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                  <div style={{
                    position: "absolute", bottom: 0, left: 0, right: 0,
                    background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)",
                    padding: "20px 7px 7px",
                    borderRadius: "0 0 10px 10px",
                    display: "flex", alignItems: "flex-end", justifyContent: "space-between"
                  }}>
                    {movie.rating ? (
                      <span style={{ fontSize: "0.72rem", fontWeight: "800", color: "#fbbf24" }}>
                        & {movie.rating.toFixed(1)}
                      </span>
                    ) : null}
                    <span style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.7)", fontWeight: "700", background: "rgba(0,0,0,0.4)", padding: "1px 5px", borderRadius: "4px" }}>
                      {movie.year || ""}
                    </span>
                  </div>
                </a>
                <a href={path} style={{ textDecoration: "none", color: "inherit" }}>
                  <h3 style={{ fontSize: "0.88rem", margin: "8px 0 2px", fontWeight: "700", color: "var(--ink)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.3 }}>{movie.title}</h3>
                </a>
              </article>
            );
          })}
        </div>

        <div className="portal-section-title" style={{ marginBottom: "16px" }}>
          <h2>Danh sách phim</h2>
        </div>
        <div className="movie-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "20px" }}>
          {latestMovies.map((movie) => (
            <MovieCard key={movie.id} movie={movie} />
          ))}
        </div>
      </div>

      {!isMobile && <aside className="portal-sidebar">
        <div className="movie-ranking-panel">
          <div className="movie-ranking-header">
            <h2>Bảng xếp hạng</h2>
          </div>
          <div className="segment" style={{ width: "100%", display: "flex", marginBottom: "16px", background: "var(--surface-2)", borderRadius: "8px", padding: "2px" }}>
            <button 
              className={rankingTab === "day" ? "selected" : ""} 
              onClick={() => setRankingTab("day")}
              style={{ flex: 1, padding: "6px", fontSize: "0.82rem", fontWeight: "bold", border: "none", background: rankingTab === "day" ? "var(--surface)" : "transparent", color: rankingTab === "day" ? "var(--ink)" : "var(--muted)", borderRadius: "6px", cursor: "pointer" }}
            >
              Ngày
            </button>
            <button 
              className={rankingTab === "week" ? "selected" : ""} 
              onClick={() => setRankingTab("week")}
              style={{ flex: 1, padding: "6px", fontSize: "0.82rem", fontWeight: "bold", border: "none", background: rankingTab === "week" ? "var(--surface)" : "transparent", color: rankingTab === "week" ? "var(--ink)" : "var(--muted)", borderRadius: "6px", cursor: "pointer" }}
            >
              Tuần
            </button>
            <button 
              className={rankingTab === "month" ? "selected" : ""} 
              onClick={() => setRankingTab("month")}
              style={{ flex: 1, padding: "6px", fontSize: "0.82rem", fontWeight: "bold", border: "none", background: rankingTab === "month" ? "var(--surface)" : "transparent", color: rankingTab === "month" ? "var(--ink)" : "var(--muted)", borderRadius: "6px", cursor: "pointer" }}
            >
              Tháng
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {rankedMovies.map((movie, index) => (
              <a 
                key={movie.id} 
                href={`#/movie/${movie.slug}`}
                style={{ display: "flex", width: "100%", gap: "10px", alignItems: "center", background: "transparent", textDecoration: "none", borderBottom: "1px solid var(--line)", padding: "10px 0", textAlign: "left", cursor: "pointer", transition: "background 0.15s" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <span style={{
                  minWidth: "26px", height: "26px", display: "inline-flex", alignItems: "center", justifyContent: "center",
                  borderRadius: "50%", fontWeight: "900", fontSize: "0.88rem", flexShrink: 0,
                  background: index === 0 ? "#f59e0b" : index === 1 ? "#94a3b8" : index === 2 ? "#b45309" : "rgba(255,255,255,0.08)",
                  color: index < 3 ? "#fff" : "var(--muted)"
                }}>
                  {index + 1}
                </span>
                <OptimizedImage src={movie.thumb} alt={movie.title} style={{ width: "38px", height: "52px", objectFit: "cover", borderRadius: "4px", background: "var(--line)", flexShrink: 0 }} />
                <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", flex: 1, minWidth: 0 }}>
                  <strong style={{ fontSize: "0.85rem", color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>{movie.title}</strong>
                  <small style={{ color: "var(--muted)", fontSize: "0.75rem", marginTop: "3px" }}>
                    {movie.rating ? `${movie.rating.toFixed(1)} & ⬢ ` : ""}{movie.year || "2026"}
                  </small>
                </div>
              </a>
            ))}
          </div>
        </div>
      </aside>}
    </section>
  );
}
