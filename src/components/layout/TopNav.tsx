import {
  BookOpen,
  Clapperboard,
  Home,
  Menu,
  Moon,
  Sun,
  Tv,
  User,
  X
} from "lucide-react";
import { useEffect, useState } from "react";
import { MOBILE_COMIC_GENRES, MOBILE_RANKING_LINKS } from "../../constants/comic";
import { MOBILE_MOVIE_TYPES } from "../../constants/movie";
import type { AuthUser, CatalogSource, ComicRankingMode, Route } from "../../types";
import { getAvatarFrameById, getReaderLevelInfo, readReaderXp, readSelectedAvatarFrameId } from "../../utils/helpers";
import { getGenreSlug, getStoredMode, navigate } from "../../utils/routing";
import { AvatarFrameBox } from "../common/AvatarFrameBox";
import { OptimizedImage } from "../common/OptimizedImage";
import { IconButton } from "../common/UIComponents";

export function TopNav({
  route,
  mainTheme,
  onToggleTheme,
  activeComicGenre,
  activeMovieType,
  onSelectComicGenre,
  onSelectComicRanking,
  onSelectMovieType,
  onOpenAuth,
  authUser,
  onLogout,
  onResetMovieFilters,
  onResetComicFilters,
  onOpenProfile,
  onOpenFavorites,
  onOpenHistory,
  onOpenAdmin,
  source,
  onSelectSource
}: {
  route: Route;
  mainTheme: string;
  onToggleTheme: () => void;
  activeComicGenre: string;
  activeMovieType: string;
  onSelectComicGenre: (genre: string) => void;
  onSelectComicRanking: (ranking: ComicRankingMode | null) => void;
  onSelectMovieType: (type: string) => void;
  onOpenAuth: () => void;
  authUser: AuthUser | null;
  onLogout: () => void;
  onResetMovieFilters: () => void;
  onResetComicFilters: () => void;
  onOpenProfile: () => void;
  onOpenFavorites: () => void;
  onOpenHistory: () => void;
  onOpenAdmin: () => void;
  source: CatalogSource;
  onSelectSource: (s: CatalogSource) => void;
}) {
  const mode = route.name === "movies" || route.name === "movie"
    ? "movie"
    : route.name === "account" || route.name === "adminPage"
      ? getStoredMode()
      : "comic";
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileMenuSection, setMobileMenuSection] = useState<"main" | "genres" | "ranking">("main");

  useEffect(() => {
    document.title = mode === "movie" ? "TPMphim" : "TPM";
    localStorage.setItem("last_mode", mode);
  }, [mode]);

  useEffect(() => {
    if (!userMenuOpen) return;
    const handler = () => setUserMenuOpen(false);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [userMenuOpen]);

  useEffect(() => {
    setMobileMenuOpen(false);
    setMobileMenuSection("main");
  }, [route.name, mode]);

  const goHome = () => {
    if (mode === "movie") {
      onResetMovieFilters();
      navigate("/movies");
    } else {
      onResetComicFilters();
      navigate("/");
    }
  };

  const goComicGenre = (slug: string) => {
    onSelectSource("truyenqq");
    onSelectComicGenre(slug);
    setMobileMenuOpen(false);
    navigate("/");
  };

  const goComicRanking = (label: string) => {
    onSelectSource("truyenqq");
    onResetComicFilters();
    const rankingIndex = MOBILE_RANKING_LINKS.indexOf(label);
    const rankingMode = (["day", "week", "month"] as const)[rankingIndex];
    if (rankingMode) {
      onSelectComicRanking(rankingMode);
      setMobileMenuOpen(false);
      navigate("/");
      return;
    }
    if (rankingIndex === 3) {
      setMobileMenuOpen(false);
      authUser ? onOpenFavorites() : onOpenAuth();
      return;
    }
    onSelectComicRanking(null);
    setMobileMenuOpen(false);
    navigate("/");
  };

  const goMovieType = (type: string) => {
    onResetMovieFilters();
    onSelectMovieType(type);
    setMobileMenuOpen(false);
    navigate("/movies");
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen((isOpen) => {
      const nextOpen = !isOpen;
      if (!nextOpen) setMobileMenuSection("main");
      return nextOpen;
    });
  };

  const navReaderLevel = getReaderLevelInfo(readReaderXp(authUser), authUser?.role);
  const navAvatarFrame = getAvatarFrameById(readSelectedAvatarFrameId(authUser, navReaderLevel.index));

  return (
    <>
      <header className="topbar">
        <div className="topbar-left">
          <button className="brand" onClick={goHome} aria-label={mode === "movie" ? "Về kho phim" : "Về kho truyện"}>
            <img className="brand-logo-img" src="/logo.png?v=pmt-20260611" alt="" />
            <span className="brand-icon">{mode === "movie" ? <Clapperboard size={22} /> : <BookOpen size={22} />}</span>
            <span className="brand-text">{mode === "movie" ? "TPMphim" : "TPM"}</span>
          </button>
          <div className="mode-switch" role="group" aria-label="Chế độ">
            <button className={mode === "comic" ? "selected" : ""} onClick={() => { onResetComicFilters(); onSelectSource("truyenqq"); navigate("/"); }}>
              <BookOpen size={17} />
              <span><span className="desktop-only-text">Đọc </span>truyện</span>
            </button>
            <button className={mode === "movie" ? "selected" : ""} onClick={() => { onResetMovieFilters(); navigate("/movies"); }}>
              <Clapperboard size={17} />
              <span><span className="desktop-only-text">Xem </span>phim</span>
            </button>
          </div>
        </div>
        <nav className="nav-actions" aria-label="Chính">
          <IconButton className="nav-icon-btn" active={route.name === "catalog"} icon={<Home size={18} />} label="Kho truyện" onClick={() => { onResetComicFilters(); navigate("/"); }} />
          <IconButton className="nav-icon-btn" active={route.name === "movies"} icon={<Tv size={18} />} label="Kho phim" onClick={() => { onResetMovieFilters(); navigate("/movies"); }} />
          <button className="theme-toggle-btn" onClick={onToggleTheme} title="Đổi giao diện" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "40px", height: "40px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", cursor: "pointer" }}>
            {mainTheme === "light" ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          {authUser ? (
            <div className="user-menu-wrap" style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
              <button
                className="user-avatar-btn"
                onClick={() => setUserMenuOpen(o => !o)}
                title={authUser.displayName || authUser.username}
              >
                <AvatarFrameBox frame={navAvatarFrame} className="nav-avatar-frame">
                  {authUser.avatar
                    ? <OptimizedImage src={authUser.avatar} alt={authUser.username} />
                    : <User size={17} />}
                </AvatarFrameBox>
                <span style={{ maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "0.88rem" }}>{authUser.displayName || authUser.username}</span>
              </button>
              {userMenuOpen && (
                <div className="user-dropdown">
                  <div className="user-dropdown-header">
                    {authUser.avatar && (
                      <AvatarFrameBox frame={navAvatarFrame} className="dropdown-avatar-frame">
                        <OptimizedImage src={authUser.avatar} alt="" />
                      </AvatarFrameBox>
                    )}
                    <div>
                      <strong>{authUser.displayName || authUser.username}</strong>
                      <small style={{ display: "block", color: "var(--muted)", fontSize: "0.78rem" }}>@{authUser.username}</small>
                    </div>
                  </div>
                  <hr style={{ border: "none", borderTop: "1px solid var(--line)", margin: "6px 0" }} />
                  {authUser.role === "admin" && (
                    <>
                      <button className="user-dropdown-item" onClick={() => { setUserMenuOpen(false); onOpenAdmin(); }} style={{ fontWeight: "bold", color: "var(--gold,#f59e0b)" }}>
                        Bảng quản trị
                      </button>
                      <hr style={{ border: "none", borderTop: "1px solid var(--line)", margin: "6px 0" }} />
                    </>
                  )}
                  <button className="user-dropdown-item" onClick={() => { setUserMenuOpen(false); onOpenProfile(); }}>
                    Thông tin cá nhân
                  </button>
                  <button className="user-dropdown-item" onClick={() => { setUserMenuOpen(false); onOpenFavorites(); }}>
                    ❤️ Danh sách yêu thích
                  </button>
                  <button className="user-dropdown-item" onClick={() => { setUserMenuOpen(false); onOpenHistory(); }}>
                    Lịch sử xem tiếp
                  </button>
                  <hr style={{ border: "none", borderTop: "1px solid var(--line)", margin: "6px 0" }} />
                  <button className="user-dropdown-item" onClick={() => { setUserMenuOpen(false); onLogout(); }}>
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button className="auth-btn" onClick={onOpenAuth} title="Đăng nhập / Đăng ký">
              <User size={17} />
              <span>Đăng nhập</span>
            </button>
          )}
          <button
            className="mobile-menu-toggle"
            onClick={toggleMobileMenu}
            data-open={mobileMenuOpen ? "true" : "false"}
            aria-label={mobileMenuOpen ? "Đóng menu" : "Mở menu"}
            title="Menu"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </nav>
        <div className="mobile-header-actions" aria-label="Chức năng nhanh trên điện thoại">
          <button className="mobile-header-action" onClick={onToggleTheme} title="Đổi giao diện" aria-label="Đổi giao diện">
            {mainTheme === "light" ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          {authUser ? (
            <div className="mobile-user-wrap" onClick={(e) => e.stopPropagation()}>
              <button
                className="mobile-header-action"
                onClick={() => setUserMenuOpen((value) => !value)}
                title={authUser.displayName || authUser.username}
                aria-label="Tài khoản"
              >
                {authUser.avatar
                  ? (
                    <AvatarFrameBox frame={navAvatarFrame} className="nav-avatar-frame">
                      <OptimizedImage src={authUser.avatar} alt={authUser.username} />
                    </AvatarFrameBox>
                  )
                  : <User size={17} />}
              </button>
              {userMenuOpen && (
                <div className="user-dropdown mobile-user-dropdown">
                  {authUser.role === "admin" && (
                    <button className="user-dropdown-item" onClick={() => { setUserMenuOpen(false); onOpenAdmin(); }}>
                      Bảng quản trị
                    </button>
                  )}
                  <button className="user-dropdown-item" onClick={() => { setUserMenuOpen(false); onOpenProfile(); }}>
                    Thông tin cá nhân
                  </button>
                  <button className="user-dropdown-item" onClick={() => { setUserMenuOpen(false); onOpenFavorites(); }}>
                    Danh sách yêu thích
                  </button>
                  <button className="user-dropdown-item" onClick={() => { setUserMenuOpen(false); onOpenHistory(); }}>
                    Lịch sử xem tiếp
                  </button>
                  <button className="user-dropdown-item" onClick={() => { setUserMenuOpen(false); onLogout(); }}>
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button className="mobile-header-action" onClick={onOpenAuth} title="Đăng nhập" aria-label="Đăng nhập">
              <User size={17} />
            </button>
          )}
          <button
            className="mobile-header-action mobile-header-menu"
            onClick={toggleMobileMenu}
            data-open={mobileMenuOpen ? "true" : "false"}
            aria-label={mobileMenuOpen ? "Đóng menu" : "Mở menu"}
            title="Menu"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>
      {mobileMenuOpen && (
        <div className="mobile-menu-layer" role="dialog" aria-modal="true" aria-label="Menu di động">
          <div className="mobile-menu-panel">
            {mobileMenuSection === "main" && (
              <div className="mobile-menu-main">
                {mode === "comic" ? (
                  <>
                    <button onClick={() => { setMobileMenuOpen(false); goHome(); }}>Trang Chủ</button>
                    <button onClick={() => setMobileMenuSection("genres")}>Thể Loại <span>▾</span></button>
                    <button onClick={() => setMobileMenuSection("ranking")}>Xếp Hạng <span>▾</span></button>
                    <button onClick={() => { setMobileMenuOpen(false); navigate("/"); }}>Tìm Truyện</button>
                    <button onClick={() => { setMobileMenuOpen(false); authUser ? onOpenHistory() : onOpenAuth(); }}>Lịch Sử</button>
                    <button onClick={() => { setMobileMenuOpen(false); authUser ? onOpenFavorites() : onOpenAuth(); }}>Theo Dõi</button>
                    <button onClick={() => goComicGenre("romance-36")}>Romance</button>
                    <button onClick={() => { setMobileMenuOpen(false); navigate("/"); }}>Truyện chữ</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => { setMobileMenuOpen(false); goHome(); }}>Trang Chủ</button>
                    <button onClick={() => setMobileMenuSection("genres")}>Thể Loại Phim <span>▾</span></button>
                    <button onClick={() => { setMobileMenuOpen(false); navigate("/movies"); }}>Tìm Phim</button>
                    <button onClick={() => { setMobileMenuOpen(false); authUser ? onOpenHistory() : onOpenAuth(); }}>Lịch Sử Xem</button>
                    <button onClick={() => { setMobileMenuOpen(false); authUser ? onOpenFavorites() : onOpenAuth(); }}>Phim Yêu Thích</button>
                    <button onClick={() => goMovieType("series")}>Phim bộ</button>
                    <button onClick={() => goMovieType("single")}>Phim lẻ</button>
                    <button onClick={() => goMovieType("hoat-hinh")}>Anime</button>
                  </>
                )}
              </div>
            )}
            {mobileMenuSection === "genres" && (
              <div className="mobile-menu-subpanel">
                <button className="mobile-menu-subtitle" onClick={() => setMobileMenuSection("main")}>{mode === "movie" ? "Thể Loại Phim" : "Thể Loại"} <span>▾</span></button>
                <div className="mobile-menu-grid">
                  {mode === "movie" ? MOBILE_MOVIE_TYPES.map((item: { name: string; type: string }) => (
                    <button key={item.name} onClick={() => goMovieType(item.type)}>
                      {item.name}
                    </button>
                  )) : MOBILE_COMIC_GENRES.map((genre) => (
                    <button key={genre.slug} onClick={() => goComicGenre(genre.slug)}>
                      {genre.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {mode === "comic" && mobileMenuSection === "ranking" && (
              <div className="mobile-menu-subpanel">
                <button className="mobile-menu-subtitle" onClick={() => setMobileMenuSection("main")}>Xếp Hạng <span>▾</span></button>
                <div className="mobile-menu-grid ranking-grid">
                  {MOBILE_RANKING_LINKS.map((item) => (
                    <button key={item} onClick={() => goComicRanking(item)}>
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      <nav className="subnav" aria-label="Danh mục nhanh">
        {mode === "comic" ? (
          <>
            {["Action", "Manhwa", "Manhua", "Manga", "Ngôn Tình", "Truyện Màu", "Comedy", "Fantasy"].map((item) => {
              const slug = getGenreSlug(item, source);
              const isSelected = activeComicGenre === slug || activeComicGenre === item;
              return (
                <button 
                  key={item} 
                  className={isSelected ? "selected" : ""} 
                  onClick={() => { onSelectComicGenre(slug); navigate("/"); }}
                >
                  {item}
                </button>
              );
            })}
          </>
        ) : (
          <>
            {["Phim mới", "Phim bộ", "Phim lẻ", "Hàn Quốc", "Trung Quốc", "Âu Mỹ", "Anime"].map((item) => {
              const typeMap: Record<string, string> = {
                "Phim mới": "",
                "Phim bộ": "series",
                "Phim lẻ": "single",
                "Hàn Quốc": "han-quoc",
                "Trung Quốc": "trung-quoc",
                "Âu Mỹ": "au-my",
                "Anime": "hoat-hinh"
              };
              const mapped = typeMap[item];
              const isSelected = activeMovieType === mapped;
              return (
                <button 
                  key={item} 
                  className={isSelected ? "selected" : ""} 
                  onClick={() => { onSelectMovieType(mapped); navigate("/movies"); }}
                >
                  {item}
                </button>
              );
            })}
          </>
        )}
      </nav>
    </>
  );
}
