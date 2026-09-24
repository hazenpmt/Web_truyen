import { useEffect, useState } from "react";
import { TopNav } from "./components/layout/TopNav";
import { AdminDashboardModal } from "./components/modals/AdminDashboardModal";
import { AuthModal } from "./components/modals/AuthModal";
import { UserDashboardModal } from "./components/modals/UserDashboardModal";
import { CatalogView } from "./pages/CatalogView";
import { ComicDetail } from "./pages/ComicDetail";
import { ImportView } from "./pages/ImportView";
import { MovieCatalogView } from "./pages/MovieCatalogView";
import { MovieDetailViewV2 } from "./pages/MovieDetailViewV2";
import { ReaderView } from "./pages/ReaderView";
import { UIPreviewView } from "./pages/UIPreviewView";
import type { AuthUser, CatalogSource, ComicRankingMode, Route } from "./types";
import { getStoredMode, navigate, parseRoute } from "./utils/routing";

export default function App() {
  const [route, setRoute] = useState<Route>(() => parseRoute());
  const currentMode = route.name === "movies" || route.name === "movie"
    ? "movie"
    : route.name === "account" || route.name === "adminPage"
      ? getStoredMode()
      : "comic";
  const skin = currentMode === "movie" ? "movie-skin" : "comic-skin";
  const [comicTheme, setComicTheme] = useState(() => localStorage.getItem("comicTheme") || "light");
  const [movieTheme, setMovieTheme] = useState(() => localStorage.getItem("movieTheme") || "dark");
  const activeTheme = skin === "movie-skin" ? movieTheme : comicTheme;
  const [triggerReload] = useState(0);
  const [source, setSource] = useState<CatalogSource>(() => {
    const saved = localStorage.getItem("catalogSource");
    if (saved === "otruyen" || !saved) {
      return "truyenqq";
    }
    return saved as CatalogSource;
  });
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [userModalTab, setUserModalTab] = useState<"profile" | "favorites" | "history">("profile");
  const [redirectPath, setRedirectPath] = useState<string | null>(null);

  // Auth state persisted in localStorage
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => {
    try {
      return JSON.parse(localStorage.getItem("auth_user") || "null");
    } catch {
      return null;
    }
  });

  // Protect routes and handle redirects
  useEffect(() => {
    if (route.name === "movie" && !authUser) {
      setRedirectPath(window.location.hash.replace(/^#/, ""));
      setShowAuthModal(true);
      navigate("/movies");
    } else if (route.name === "importer") {
      if (!authUser || authUser.role !== "admin") {
        navigate("/");
      }
    } else if (route.name === "account" && !authUser) {
      setRedirectPath(window.location.hash.replace(/^#/, ""));
      setShowAuthModal(true);
      navigate("/");
    } else if (route.name === "adminPage" && (!authUser || authUser.role !== "admin")) {
      navigate("/");
    }
  }, [route.name, authUser]);

  // Scroll to top and sync last_mode on route change
  useEffect(() => {
    window.scrollTo({ top: 0 });
    if (route.name === "movies" || route.name === "movie") {
      localStorage.setItem("last_mode", "movie");
    } else if (
      route.name === "catalog" ||
      route.name === "comic" ||
      route.name === "comicApi" ||
      route.name === "comicQQ" ||
      route.name === "reader" ||
      route.name === "readerApi" ||
      route.name === "readerQQ" ||
      route.name === "importer"
    ) {
      localStorage.setItem("last_mode", "comic");
    }
  }, [route]);

  const handleLogin = (user: AuthUser | null, token: string) => {
    setAuthUser(user);
    localStorage.setItem("auth_user", JSON.stringify(user));
    localStorage.setItem("auth_token", token);
    setShowAuthModal(false);
    if (redirectPath) {
      navigate(redirectPath);
      setRedirectPath(null);
    }
  };

  const handleLogout = () => {
    setAuthUser(null);
    localStorage.removeItem("auth_user");
    localStorage.removeItem("auth_token");
  };

  // Global Filter States
  const [comicSearch, setComicSearch] = useState("");
  const [comicGenre, setComicGenre] = useState("");
  const [comicStatus, setComicStatus] = useState("");
  const [comicRanking, setComicRanking] = useState<ComicRankingMode | null>(null);

  const [movieSearch, setMovieSearch] = useState("");
  const [movieType, setMovieType] = useState("");

  const resetMovieFilters = () => { setMovieSearch(""); setMovieType(""); };
  const resetComicFilters = () => { setComicSearch(""); setComicGenre(""); setComicStatus(""); setComicRanking(null); };

  const toggleActiveTheme = () => {
    if (skin === "movie-skin") {
      const next = movieTheme === "light" ? "dark" : "light";
      setMovieTheme(next);
      localStorage.setItem("movieTheme", next);
    } else {
      const next = comicTheme === "light" ? "dark" : "light";
      setComicTheme(next);
      localStorage.setItem("comicTheme", next);
    }
  };

  useEffect(() => {
    const onHashChange = () => setRoute(parseRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return (
    <div className={`app ${skin} main-theme-${activeTheme}`}>
      <TopNav 
        route={route} 
        mainTheme={activeTheme} 
        onToggleTheme={toggleActiveTheme} 
        activeComicGenre={comicGenre}
        activeMovieType={movieType}
        onSelectComicGenre={(genre) => {
          setComicGenre(genre);
          setComicSearch("");
          setComicStatus("");
          setComicRanking(null);
        }}
        onSelectComicRanking={setComicRanking}
        onSelectMovieType={(type) => {
          setMovieType(type);
          setMovieSearch("");
        }}
        onOpenAuth={() => setShowAuthModal(true)}
        authUser={authUser}
        onLogout={handleLogout}
        onResetMovieFilters={resetMovieFilters}
        onResetComicFilters={resetComicFilters}
        onOpenProfile={() => { setUserModalTab("profile"); navigate("/account/profile"); }}
        onOpenFavorites={() => { setUserModalTab("favorites"); navigate("/account/favorites"); }}
        onOpenHistory={() => { setUserModalTab("history"); navigate("/account/history"); }}
        onOpenAdmin={() => navigate("/admin")}
        source={source}
        onSelectSource={(s) => {
          setSource(s);
          resetComicFilters();
        }}
      />
      {route.name === "catalog" && (
        <CatalogView 
          source={source}
          setSource={setSource}
          triggerReload={triggerReload}
          search={comicSearch}
          setSearch={setComicSearch}
          genre={comicGenre}
          setGenre={setComicGenre}
          status={comicStatus}
          setStatus={setComicStatus}
          ranking={comicRanking}
          setRanking={setComicRanking}
          authUser={authUser}
        />
      )}
      {route.name === "comic" && <ComicDetail slug={route.slug} onSelectGenre={(g: string) => { setComicGenre(g); navigate("/"); }} />}
      {route.name === "comicApi" && <ComicDetail slug={route.slug} source="otruyen" onSelectGenre={(g: string) => { setComicGenre(g); setSource("otruyen"); navigate("/"); }} />}
      {route.name === "comicQQ" && <ComicDetail slug={route.slug} source="truyenqq" onSelectGenre={(g: string) => { setComicGenre(g); setSource("truyenqq"); navigate("/"); }} />}
      {route.name === "reader" && <ReaderView comicSlug={route.comicSlug} chapterSlug={route.chapterSlug} />}
      {route.name === "readerApi" && <ReaderView comicSlug={route.comicSlug} chapterSlug={route.chapterSlug} source="otruyen" />}
      {route.name === "readerQQ" && <ReaderView comicSlug={route.comicSlug} chapterSlug={route.chapterSlug} source="truyenqq" />}
      {route.name === "importer" && <ImportView />}
      {route.name === "account" && authUser && (
        <UserDashboardModal
          embedded
          tab={route.tab}
          onClose={() => navigate(currentMode === "movie" ? "/movies" : "/")}
          authUser={authUser}
          onUpdateUser={(updated) => {
            setAuthUser(updated);
            localStorage.setItem("auth_user", JSON.stringify(updated));
          }}
          mode={currentMode}
        />
      )}
      {route.name === "adminPage" && authUser?.role === "admin" && (
        <AdminDashboardModal
          embedded
          onClose={() => navigate(currentMode === "movie" ? "/movies" : "/")}
          authUser={authUser}
        />
      )}
      {route.name === "movies" && (
        <MovieCatalogView 
          search={movieSearch}
          setSearch={setMovieSearch}
          type={movieType}
          setType={setMovieType}
        />
      )}
      {route.name === "movie" && (
        <MovieDetailViewV2 
          slug={route.slug} 
          episodeSlug={route.episodeSlug} 
          authUser={authUser}
          onUpdateUser={(updated) => {
            setAuthUser(updated);
            localStorage.setItem("auth_user", JSON.stringify(updated));
          }}
          onSelectCategory={(cat, country) => {
            const countryMap: Record<string, string> = {
              "Hàn Quốc": "han-quoc",
              "Trung Quốc": "trung-quoc",
              "Âu Mỹ": "au-my"
            };
            const catMap: Record<string, string> = {
              "Hoạt Hình": "hoat-hinh",
              "Anime": "hoat-hinh",
              "Phim Bộ": "series",
              "Phim Lẻ": "single"
            };
            if (country && countryMap[country]) {
              setMovieType(countryMap[country]);
              setMovieSearch("");
            } else if (cat && catMap[cat]) {
              setMovieType(catMap[cat]);
              setMovieSearch("");
            } else {
              setMovieType("");
              setMovieSearch(cat || country || "");
            }
            navigate("/movies");
          }}
        />
      )}
      {route.name === "uiPreview" && <UIPreviewView />}
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} onLogin={handleLogin} />}
      {showUserModal && (
        <UserDashboardModal
          tab={userModalTab}
          onClose={() => setShowUserModal(false)}
          authUser={authUser}
          onUpdateUser={(updated) => {
            setAuthUser(updated);
            localStorage.setItem("auth_user", JSON.stringify(updated));
          }}
          mode={currentMode}
        />
      )}
      {showAdminModal && (
        <AdminDashboardModal
          onClose={() => setShowAdminModal(false)}
          authUser={authUser}
        />
      )}
    </div>
  );
}
