import { DownloadCloud, Eye, Library, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchComics, fetchMeta, fetchOTruyenComics, fetchOTruyenMeta, fetchTruyenQQComics, fetchTruyenQQMeta, fetchTruyenQQRanking } from "../api";
import { OptimizedImage } from "../components/common/OptimizedImage";
import { Notice, PaginationControls } from "../components/common/UIComponents";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useIsMobile } from "../hooks/useIsMobile";
import type { AuthUser, CatalogSource, ComicRankingMode, ComicSummary } from "../types";
import { formatRelativeTime, formatViews } from "../utils/helpers";
import { comicPath, navigate, readPath } from "../utils/routing";

export function CatalogView({
  triggerReload,
  search,
  setSearch,
  genre,
  setGenre,
  status,
  setStatus,
  ranking,
  setRanking,
  authUser,
  source,
  setSource
}: {
  triggerReload: number;
  search: string;
  setSearch: (s: string) => void;
  genre: string;
  setGenre: (g: string) => void;
  status: string;
  setStatus: (st: string) => void;
  ranking: ComicRankingMode | null;
  setRanking: (ranking: ComicRankingMode | null) => void;
  authUser?: AuthUser | null;
  source: CatalogSource;
  setSource: (s: CatalogSource) => void;
}) {
  const isMobile = useIsMobile();
  const debouncedSearch = useDebouncedValue(search, 350);
  const pageLimit = isMobile ? 12 : 24;
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [meta, setMeta] = useState<{ genres: Array<{ value: string; label: string }>; statuses: Array<{ value: string; label: string }> }>({ genres: [], statuses: [] });
  const [comics, setComics] = useState<ComicSummary[]>([]);
  const [rankingComics, setRankingComics] = useState<ComicSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (source === "otruyen") {
      fetchOTruyenComics({ type: "truyen-moi", page: 1 })
        .then(payload => setRankingComics(payload.items.slice(0, 10)))
        .catch(() => {});
    } else if (source === "truyenqq") {
      fetchTruyenQQComics({ page: 1, limit: isMobile ? 8 : 10 })
        .then(payload => setRankingComics(payload.items.slice(0, 10)))
        .catch(() => {});
    } else {
      fetchComics({ page: 1, limit: isMobile ? 8 : 10 })
        .then(payload => setRankingComics(payload.items.slice(0, 10)))
        .catch(() => {});
    }
  }, [source, triggerReload, isMobile]);

  useEffect(() => {
    localStorage.setItem("catalogSource", source);
    setPage(1);
  }, [source]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, genre, status, ranking, pageLimit]);

  useEffect(() => {
    setMeta({ genres: [], statuses: [] });
    setError("");
    if (source === "otruyen") {
      fetchOTruyenMeta()
        .then((payload) => {
          setMeta({
            genres: payload.genres.map((item) => ({ value: item.slug, label: item.name })),
            statuses: payload.statuses.map((item) => ({ value: String(item.value), label: item.label }))
          });
        })
        .catch((error: Error) => setError(error.message));
    } else if (source === "truyenqq") {
      fetchTruyenQQMeta()
        .then((payload) => {
          setMeta({
            genres: payload.genres.map((item) => ({ value: item.slug, label: item.name })),
            statuses: payload.statuses.map((item) => ({ value: String(item.value), label: item.label }))
          });
        })
        .catch((error: Error) => setError(error.message));
    } else {
      fetchMeta()
        .then((payload) => {
          setMeta({
            genres: payload.genres.map((item) => ({ value: item, label: item })),
            statuses: payload.statuses.map((item) => ({ value: String(item.value), label: item.label }))
          });
        })
        .catch((error: Error) => setError(error.message));
    }
  }, [source]);

  useEffect(() => {
    let ignore = false;
    setLoading(true);

    if (source === "truyenqq" && ranking) {
      fetchTruyenQQRanking(ranking)
        .then((payload) => {
          if (!ignore) {
            setComics(payload.items || []);
            setTotalPages(1);
            setTotalItems((payload.items || []).length);
            setError("");
          }
        })
        .catch((error: Error) => {
          if (!ignore) setError(error.message);
        })
        .finally(() => {
          if (!ignore) setLoading(false);
        });
    } else if (source === "otruyen") {
      fetchOTruyenComics({ search: debouncedSearch, category: genre, type: status || "truyen-moi", page })
        .then((payload) => {
          if (!ignore) {
            setComics(payload.items);
            setTotalPages(payload.pagination.totalPages);
            setTotalItems(payload.pagination.totalItems);
            setError("");
          }
        })
        .catch((error: Error) => {
          if (!ignore) setError(error.message);
        })
        .finally(() => {
          if (!ignore) setLoading(false);
        });
    } else if (source === "truyenqq") {
      fetchTruyenQQComics({ search: debouncedSearch, category: genre, page, limit: pageLimit })
        .then((payload) => {
          if (!ignore) {
            setComics(payload.items);
            setTotalPages(payload.pagination.totalPages);
            setTotalItems(payload.pagination.totalItems);
            setError("");
          }
        })
        .catch((error: Error) => {
          if (!ignore) setError(error.message);
        })
        .finally(() => {
          if (!ignore) setLoading(false);
        });
    } else {
      fetchComics({ search: debouncedSearch, genre, status, page, limit: pageLimit })
        .then((payload) => {
          if (!ignore) {
            setComics(payload.items);
            setTotalPages(payload.pagination.totalPages);
            setTotalItems(payload.pagination.totalItems);
            setError("");
          }
        })
        .catch((error: Error) => {
          if (!ignore) setError(error.message);
        })
        .finally(() => {
          if (!ignore) setLoading(false);
        });
    }

    return () => {
      ignore = true;
    };
  }, [source, debouncedSearch, genre, status, ranking, page, pageLimit, triggerReload]);

  const rankingTitle = ranking === "day" ? "Top ngày" : ranking === "week" ? "Top tuần" : ranking === "month" ? "Top tháng" : undefined;

  return (
    <main className="page">
      <section className="toolbar" aria-label="Bộ lọc" style={{ marginTop: 0 }}>
        <label className="search-box">
          <Search size={18} />
          <input value={search} onChange={(event) => { setRanking(null); setSearch(event.target.value); }} placeholder="Tìm truyện, tác giả, thể loại" />
        </label>
        <label className="select-box">
          <Library size={18} />
          <select value={genre} onChange={(event) => { setRanking(null); setGenre(event.target.value); }}>
            <option value="">Tất cả thể loại</option>
            {meta.genres.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <div className="segment" role="group" aria-label="Trạng thái">
          <button className={!status ? "selected" : ""} onClick={() => { setRanking(null); setStatus(""); }}>
            Tất cả
          </button>
          {meta.statuses.map((item) => (
            <button key={item.value} className={status === item.value ? "selected" : ""} onClick={() => { setRanking(null); setStatus(String(item.value)); }}>
              {item.label}
            </button>
          ))}
        </div>
        {authUser?.role === "admin" && (
          <div style={{ display: "flex", gap: "8px" }}>
            <button className="primary-action" onClick={() => navigate("/import")}>
              <DownloadCloud size={18} />
              <span>Nạp truyện</span>
            </button>
          </div>
        )}
      </section>

      {error && <Notice tone="error" message={error} />}

      {loading ? (
        <div className="loading-row">Đang tải...</div>
      ) : comics.length > 0 ? (
        <ComicPortalLayout comics={comics} rankingComics={rankingComics} source={source} isFiltered={!!(debouncedSearch || genre || status || ranking)} totalItems={totalItems} sectionTitle={rankingTitle} />
      ) : (
        <div className="loading-row" style={{ textAlign: "center", padding: "40px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
          <div style={{ fontSize: "1rem", color: "var(--ink)" }}>
            {source === "otruyen" ? "Không tìm thấy truyện nào." : "Chưa có truyện nào trong kho nội bộ."}
          </div>
          {source === "local" && (
            <div style={{ display: "flex", gap: "10px", marginTop: "8px", flexWrap: "wrap", justifyContent: "center" }}>
              <button className="primary-action" onClick={() => setSource("otruyen")}>🚀 Xem kho OTruyen API (Hàng ngàn truyện)</button>
              <button className="secondary-action" onClick={() => setSource("truyenqq")}>🔥 Xem kho TruyenQQ (Live)</button>
            </div>
          )}
        </div>
      )}

      {totalPages > 1 && (
        <PaginationControls page={page} totalPages={totalPages} totalItems={totalItems} onPageChange={setPage} />
      )}
    </main>
  );
}

export function ComicPortalLayout({ comics, rankingComics, source, isFiltered, totalItems, sectionTitle }: { comics: ComicSummary[]; rankingComics: ComicSummary[]; source: CatalogSource; isFiltered: boolean; totalItems?: number; sectionTitle?: string }) {
  const isMobile = useIsMobile();
  const hotComics = isFiltered ? [] : [...comics].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, isMobile ? 8 : 30);
  const latestComics = isFiltered ? comics : comics;
  const sidebarComics = rankingComics.length > 0 ? rankingComics : [...comics].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 20);
  const [rankingTab, setRankingTab] = useState<"day" | "week" | "month">("day");
  const [liveRankingComics, setLiveRankingComics] = useState<ComicSummary[]>([]);
  const [rankingLoading, setRankingLoading] = useState(false);
  const hotScrollRef = useRef<HTMLDivElement>(null);
  const [isAutoScrolling, setIsAutoScrolling] = useState(true);
  const hotCardWidth = 150;

  useEffect(() => {
    if (isMobile || !isAutoScrolling || !hotScrollRef.current || hotComics.length === 0) return;
    const timer = setInterval(() => {
      const el = hotScrollRef.current;
      if (!el) return;
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (el.scrollLeft >= maxScroll - 10) {
        el.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        el.scrollBy({ left: hotCardWidth * 2, behavior: "smooth" });
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [isMobile, isAutoScrolling, hotComics.length]);

  const scrollHotLeft = () => {
    setIsAutoScrolling(false);
    hotScrollRef.current?.scrollBy({ left: -(hotCardWidth * 3), behavior: "smooth" });
  };
  const scrollHotRight = () => {
    setIsAutoScrolling(false);
    hotScrollRef.current?.scrollBy({ left: hotCardWidth * 3, behavior: "smooth" });
  };

  useEffect(() => {
    if (source !== "truyenqq") {
      setLiveRankingComics([]);
      setRankingLoading(false);
      return;
    }
    let ignore = false;
    setRankingLoading(true);
    fetchTruyenQQRanking(rankingTab)
      .then((payload) => {
        if (!ignore) setLiveRankingComics(payload.items || []);
      })
      .catch(() => {
        if (!ignore) setLiveRankingComics([]);
      })
      .finally(() => {
        if (!ignore) setRankingLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [source, rankingTab]);

  const rankedComics = useMemo(() => {
    if (source === "truyenqq" && liveRankingComics.length > 0) {
      return liveRankingComics.slice(0, 10);
    }
    const base = [...sidebarComics];
    if (rankingTab === "week") {
      return base.sort((a, b) => {
        const aScore = (a.views || 0) * 0.7 + (a.totalChapters || 0) * 100;
        const bScore = (b.views || 0) * 0.7 + (b.totalChapters || 0) * 100;
        return bScore - aScore;
      }).slice(0, 10);
    }
    if (rankingTab === "month") {
      return base.sort((a, b) => (b.totalChapters || 0) - (a.totalChapters || 0)).slice(0, 10);
    }
    return base.sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 10);
  }, [liveRankingComics, rankingTab, sidebarComics, source]);

  const visibleLatest = latestComics;

  return (
    <section className="comic-portal-layout">
      <div className="portal-main">
        {hotComics.length > 0 && !isFiltered && (
          <>
            <div className="portal-section-title">
              <h2 style={{ color: "var(--teal)", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "1rem" }}>Truyện hot</h2>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <button className="carousel-nav-btn" onClick={scrollHotLeft} aria-label="Trước">&#9664;</button>
                <button className="carousel-nav-btn" onClick={scrollHotRight} aria-label="Sau">&#9654;</button>
              </div>
            </div>
            <div className="hot-scroll-row" ref={hotScrollRef}>
              {hotComics.map((comic, index) => (
                <article key={comic.id} className="portal-hot-card">
                  <a href={comicPath(source, comic.slug)} style={{ position: "relative", display: "block", width: "100%" }}>
                    <OptimizedImage src={comic.cover} alt={comic.title} referrerPolicy="no-referrer" style={{ display: "block", width: "100%" }} />
                    <span className="hot-new-badge">{index < 3 ? "Hot" : "New"}</span>
                  </a>
                  <a className="comic-title-btn hot-title-btn" href={comicPath(source, comic.slug)}>
                    <h3>{comic.title}</h3>
                  </a>
                  {comic.latestChapter && (
                    <a className="chapter-link" href={readPath(source, comic.slug, comic.latestChapter?.slug || "")}>
                      {comic.latestChapter.title}
                    </a>
                  )}
                </article>
              ))}
            </div>
          </>
        )}

        <div className="portal-section-title" style={{ marginTop: hotComics.length > 0 && !isFiltered ? "28px" : 0 }}>
          <h2>{sectionTitle || "Truyện mới cập nhật"}</h2>
          {totalItems !== undefined && (
            <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>{totalItems.toLocaleString()} truyện</span>
          )}
        </div>
        <div className="portal-update-list">
          {visibleLatest.map((comic) => (
            <article key={comic.id} className="portal-update-row">
              <a className="portal-thumb" href={comicPath(source, comic.slug)}>
                <OptimizedImage src={comic.cover} alt={comic.title} referrerPolicy="no-referrer" />
              </a>
              <div style={{ flex: 1, minWidth: 0 }}>
                <a className="comic-title-btn" href={comicPath(source, comic.slug)}>
                  <h3>{comic.title}</h3>
                </a>
                <div className="chip-row">
                  {comic.genres.slice(0, 3).map((genre) => (
                    <span className="chip" key={genre}>{genre}</span>
                  ))}
                </div>
                {comic.updatedAt && (
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block", marginTop: "3px" }}>
                    {formatRelativeTime(comic.updatedAt)}
                  </span>
                )}
              </div>
              {comic.latestChapter && (
                <a className="chapter-link update-chap-link" href={readPath(source, comic.slug, comic.latestChapter?.slug || "")}>
                  {comic.latestChapter.title}
                </a>
              )}
            </article>
          ))}
        </div>
      </div>

      {!isMobile && <aside className="portal-sidebar">
        <div className="ranking-card">
          <div className="portal-section-title" style={{ marginBottom: "10px" }}>
            <h2 style={{ fontSize: "1rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>Bảng xếp hạng</h2>
          </div>
          <div className="ranking-tab-group">
            {(["day", "week", "month"] as const).map(tab => (
              <button
                key={tab}
                className={rankingTab === tab ? "rtab selected" : "rtab"}
                onClick={() => setRankingTab(tab)}
              >
                {tab === "day" ? "Ngày" : tab === "week" ? "Tuần" : "Tháng"}
              </button>
            ))}
          </div>
          {rankingLoading && <div className="ranking-loading">Đang cập nhật bảng xếp hạng...</div>}
          {rankedComics.map((comic, index) => (
            <a key={`${rankingTab}-${comic.id}`} className="ranking-row" href={comicPath(source, comic.slug)}>
              <span className={index < 3 ? `rank-num rank-${index + 1}` : "rank-num"}>{index + 1}</span>
              <OptimizedImage src={comic.cover} alt={comic.title} referrerPolicy="no-referrer" />
              <div className="ranking-info">
                <strong>{comic.title}</strong>
                <div className="ranking-meta">
                  <span className="rank-chap">
                    {comic.latestChapter ? comic.latestChapter.title : `${comic.totalChapters || 0} chap`}
                  </span>
                  <span className="rank-views">
                    <Eye size={12} />
                    {formatViews(comic.views || 0)}
                  </span>
                </div>
              </div>
            </a>
          ))}
        </div>
      </aside>}
    </section>
  );
}
