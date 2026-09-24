import { BookOpen, Clapperboard, Eye, EyeOff, LogIn, X } from "lucide-react";
import { useState } from "react";
import type { AuthUser } from "../../types";

export function AuthModal({
  onClose,
  onLogin
}: {
  onClose: () => void;
  onLogin: (user: AuthUser | null, token: string) => void;
}) {
  const mode = window.location.pathname.includes("/movies") || window.location.pathname.includes("/movie") ? "movie" : "comic";
  const [tab, setTab] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const endpoint = tab === "login" ? "/api/auth/login" : "/api/auth/register";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Lỗi không xác định.");
      onLogin(data.user, data.token);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Lỗi kết nối.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="auth-modal">
        <button className="auth-modal-close" onClick={onClose} aria-label="Đóng">
          <X size={20} />
        </button>

        <div className="auth-modal-logo">
          {mode === "movie" ? <Clapperboard size={28} /> : <BookOpen size={28} />}
          <span>{mode === "movie" ? "TPMphim" : "TPM"}</span>
        </div>

        <div className="auth-tabs">
          <button className={tab === "login" ? "selected" : ""} onClick={() => { setTab("login"); setError(""); setShowPassword(false); }}>
            Đăng nhập
          </button>
          <button className={tab === "register" ? "selected" : ""} onClick={() => { setTab("register"); setError(""); setShowPassword(false); }}>
            Đăng ký
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-field">
            <span>Tên tài khoản</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={tab === "register" ? "Ít nhất 6 ký tự, không dấu" : "Nhập tên tài khoản"}
              autoComplete="username"
              required
              disabled={loading}
            />
          </label>
          <label className="auth-field">
            <span>Mật khẩu</span>
            <div className="auth-password-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={tab === "register" ? "Ít nhất 6 ký tự" : "Nhập mật khẩu"}
                autoComplete={tab === "login" ? "current-password" : "new-password"}
                required
                disabled={loading}
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          {error && (
            <div style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: "8px", padding: "10px 14px", color: "#ef4444", fontSize: "0.88rem", fontWeight: 600 }}>
              {error}
            </div>
          )}

          <button className="auth-submit-btn" type="submit" disabled={loading}>
            <LogIn size={17} />
            <span>{loading ? "Đang xử lý..." : tab === "login" ? "Đăng nhập" : "Tạo tài khoản"}</span>
          </button>
        </form>

        <p className="auth-switch">
          {tab === "login" ? (
            <>Chưa có tài khoản? <button onClick={() => { setTab("register"); setError(""); }}>Đăng ký ngay</button></>
          ) : (
            <>Đã có tài khoản? <button onClick={() => { setTab("login"); setError(""); }}>Đăng nhập</button></>
          )}
        </p>
      </div>
    </div>
  );
}
