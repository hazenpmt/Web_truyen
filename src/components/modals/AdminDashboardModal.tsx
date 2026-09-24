import { Lock, Plus, Trash2, User, X } from "lucide-react";
import { useEffect, useState } from "react";
import { STATUS_LABELS } from "../../constants/comic";
import type { AuthUser, ComicSummary } from "../../types";
import { formatDate, formatDateTime, formatNumber } from "../../utils/routing";

export function AdminDashboardModal({
  onClose,
  authUser,
  embedded = false
}: {
  onClose: () => void;
  authUser: AuthUser | null;
  embedded?: boolean;
}) {
  const [currentTab, setCurrentTab] = useState<"stats" | "users" | "comics" | "logs" | "updates" | "truyenqq-compare">("stats");

  const [stats, setStats] = useState<{
    totalUsers: number;
    importedComics: number;
    onlineMovies: number;
    onlineComics: number;
  } | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState("");

  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState("");

  const [comics, setComics] = useState<ComicSummary[]>([]);
  const [comicsLoading, setComicsLoading] = useState(false);
  const [comicsError, setComicsError] = useState("");

  const [logsData, setLogsData] = useState<{
    recentLogs: any[];
    todayStats: {
      totalRequests: number;
      uniqueIPs: number;
      topIPs: Array<{ ip: string; count: number }>;
      topActivities: Array<{ action: string; count: number }>;
      activeUsers: Array<{ username: string; count: number }>;
    };
  } | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState("");

  const [updatesData, setUpdatesData] = useState<{
    localComics: any[];
    onlineComics: any[];
    onlineMovies: any[];
    todayDate: string;
  } | null>(null);
  const [updatesLoading, setUpdatesLoading] = useState(false);
  const [updatesError, setUpdatesError] = useState("");

  const [syncData, setSyncData] = useState<{
    status: string; progress: string; lastRun?: string;
    results: Array<{
      title: string; truyenqqSlug: string; truyenqqUrl: string;
      truyenqqChap: number; truyenqqUpdated: string;
      otruyenSlug: string | null; otruyenChap: number | null;
      diff: number; matched: boolean;
    }>;
  } | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncTriggering, setSyncTriggering] = useState(false);
  const [syncError, setSyncError] = useState("");

  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  const [qqPages, setQqPages] = useState(50);
  const [qqSyncLoading, setQqSyncLoading] = useState(false);
  const [qqSyncStatus, setQqSyncStatus] = useState<{
    isRunning: boolean;
    phase: string;
    currentPage: number;
    totalPages: number;
    addedCount: number;
    updatedCount: number;
    currentComic: string;
    lastActiveTime: string;
  } | null>(null);
  const [qqLocalCount, setQqLocalCount] = useState(0);
  const [qqEstimatedTotal, setQqEstimatedTotal] = useState(0);

  useEffect(() => {
    if (currentTab !== "updates") return;
    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/admin/truyenqq-sync/status", { headers: getHeaders() });
        const data = await res.json();
        if (res.ok) {
          setQqSyncStatus(data.status);
          setQqLocalCount(data.localCount);
          setQqEstimatedTotal(data.estimatedTotal || 0);
        }
      } catch {}
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [currentTab]);

  const getHeaders = () => ({
    "content-type": "application/json",
    "authorization": `Bearer ${localStorage.getItem("auth_token") || ""}`
  });

  const handleTriggerQQSync = async (crawlAll = false) => {
    setQqSyncLoading(true);
    setActionError("");
    setActionSuccess("");
    try {
      const res = await fetch("/api/admin/truyenqq-sync", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(crawlAll ? { all: true } : { pages: qqPages })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Không thể kích hoạt trình cào.");
      setActionSuccess(data.message || `Đã kích hoạt cào ${crawlAll ? "toàn bộ TruyenQQ" : `${qqPages} trang TruyenQQ`}.`);
    } catch (err: any) {
      setActionError(err.message || "Có lỗi xảy ra khi kích hoạt cào.");
    } finally {
      setQqSyncLoading(false);
    }
  };

  const loadStats = async () => {
    setStatsLoading(true);
    setStatsError("");
    try {
      const res = await fetch("/api/admin/stats", { headers: getHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Không thể lấy số liệu thống kê.");
      setStats(data);
    } catch (err: any) {
      setStatsError(err.message || "Lỗi tải dữ liệu.");
    } finally {
      setStatsLoading(false);
    }
  };

  const loadUsers = async () => {
    setUsersLoading(true);
    setUsersError("");
    try {
      const res = await fetch("/api/admin/users", { headers: getHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Không thể tải danh sách thành viên.");
      setUsers(data);
    } catch (err: any) {
      setUsersError(err.message || "Lỗi tải dữ liệu.");
    } finally {
      setUsersLoading(false);
    }
  };

  const loadComics = async () => {
    setComicsLoading(true);
    setComicsError("");
    try {
      const res = await fetch("/api/comics?limit=200");
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Không thể tải danh sách truyện.");
      setComics(Array.isArray(data) ? data : data.items || []);
    } catch (err: any) {
      setComicsError(err.message || "Lỗi tải dữ liệu.");
    } finally {
      setComicsLoading(false);
    }
  };

  const loadLogs = async () => {
    setLogsLoading(true);
    setLogsError("");
    try {
      const res = await fetch("/api/admin/logs", { headers: getHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Không thể tải nhật ký hoạt động.");
      setLogsData(data);
    } catch (err: any) {
      setLogsError(err.message || "Lỗi tải nhật ký.");
    } finally {
      setLogsLoading(false);
    }
  };

  const loadUpdates = async () => {
    setUpdatesLoading(true);
    setUpdatesError("");
    try {
      const res = await fetch("/api/admin/today-updates", { headers: getHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Không thể tải danh sách cập nhật mới.");
      setUpdatesData(data);
    } catch (err: any) {
      setUpdatesError(err.message || "Lỗi tải dữ liệu cập nhật.");
    } finally {
      setUpdatesLoading(false);
    }
  };

  const loadTruyenQQCompare = async () => {
    setSyncLoading(true);
    setSyncError("");
    try {
      const res = await fetch("/api/admin/truyenqq-sync/compare", { headers: getHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Lỗi tải kết quả.");
      setSyncData(data);
    } catch (err: any) {
      setSyncError(err.message || "Lỗi tải dữ liệu.");
    } finally {
      setSyncLoading(false);
    }
  };

  const triggerTruyenQQCompare = async (pages: number) => {
    setSyncTriggering(true);
    setSyncError("");
    try {
      const res = await fetch("/api/admin/truyenqq-sync/compare", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ pages })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Lỗi kết nối.");
      setActionSuccess(data.message || "Đã bắt đầu so sánh!");
      const poll = setInterval(async () => {
        try {
          const r = await fetch("/api/admin/truyenqq-sync/compare", { headers: getHeaders() });
          const d = await r.json();
          setSyncData(d);
          if (d.status !== "running") clearInterval(poll);
        } catch { clearInterval(poll); }
      }, 5000);
    } catch (err: any) {
      setSyncError(err.message);
    } finally {
      setSyncTriggering(false);
    }
  };

  useEffect(() => {
    setActionError("");
    setActionSuccess("");
    if (currentTab === "stats") {
      loadStats();
    } else if (currentTab === "users") {
      loadUsers();
    } else if (currentTab === "comics") {
      loadComics();
    } else if (currentTab === "logs") {
      loadLogs();
    } else if (currentTab === "updates") {
      loadUpdates();
    } else if (currentTab === "truyenqq-compare") {
      loadTruyenQQCompare();
    }
  }, [currentTab]);

  const handleToggleRole = async (targetUser: any) => {
    setActionError("");
    setActionSuccess("");
    const nextRole = targetUser.role === "admin" ? "user" : "admin";
    
    if (targetUser.id === authUser?.id) {
      setActionError("Bạn không thể tự thay đổi vai trò của chính mình.");
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/${targetUser.id}/role`, {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify({ role: nextRole })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Không thể cập nhật vai trò.");
      setActionSuccess(`Đã thay đổi vai trò của @${targetUser.username} thành ${nextRole}.`);
      loadUsers();
    } catch (err: any) {
      setActionError(err.message || "Lỗi khi cập nhật vai trò.");
    }
  };

  const handleDeleteUser = async (targetUser: any) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa thành viên @${targetUser.username}? Hành động này không thể hoàn tác.`)) {
      return;
    }

    setActionError("");
    setActionSuccess("");

    if (targetUser.id === authUser?.id) {
      setActionError("Bạn không thể tự xóa tài khoản của chính mình.");
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/${targetUser.id}`, {
        method: "DELETE",
        headers: getHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Không thể xóa thành viên.");
      setActionSuccess(`Đã xóa thành viên @${targetUser.username} khỏi hệ thống.`);
      loadUsers();
    } catch (err: any) {
      setActionError(err.message || "Lỗi khi xóa thành viên.");
    }
  };

  const handleResetPassword = async (targetUser: any) => {
    const newPass = prompt(`Nhập mật khẩu mới cho tài khoản @${targetUser.username}:`, "123456");
    if (!newPass) return;
    if (newPass.length < 6) {
      alert("Mật khẩu mới phải có ít nhất 6 ký tự.");
      return;
    }

    setActionError("");
    setActionSuccess("");

    try {
      const res = await fetch(`/api/admin/users/${targetUser.id}/password`, {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify({ newPassword: newPass })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Không thể đổi mật khẩu.");
      setActionSuccess(`Đổi mật khẩu của @${targetUser.username} thành: ${newPass}`);
      loadUsers();
    } catch (err: any) {
      setActionError(err.message || "Lỗi khi đổi mật khẩu.");
    }
  };

  const handleDeleteComic = async (comic: ComicSummary) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa truyện "${comic.title}" khỏi cơ sở dữ liệu local?`)) {
      return;
    }

    setActionError("");
    setActionSuccess("");

    try {
      const res = await fetch(`/api/admin/comics/${comic.slug}`, {
        method: "DELETE",
        headers: getHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Không thể xóa truyện.");
      setActionSuccess(`Đã xóa thành công truyện "${comic.title}".`);
      loadComics();
    } catch (err: any) {
      setActionError(err.message || "Lỗi khi xóa truyện.");
    }
  };

  const content = (
      <div className={embedded ? "account-page-panel admin-page-panel" : "auth-modal"} style={{ width: "min(780px, calc(100vw - 32px))", padding: "28px 24px" }}>
        <button className="auth-modal-close" onClick={onClose} aria-label="Đóng">
          <X size={20} />
        </button>

        <h2 style={{ fontSize: "1.3rem", fontWeight: 800, marginBottom: "18px", color: "var(--ink)", display: "flex", alignItems: "center", gap: "8px" }}>
          <span>🛠️ Bảng Quản Trị Hệ Thống</span>
        </h2>

        <div className="auth-tabs" style={{ marginBottom: "20px" }}>
          <button className={currentTab === "stats" ? "selected" : ""} onClick={() => setCurrentTab("stats")}>
            Thống kê chung
          </button>
          <button className={currentTab === "users" ? "selected" : ""} onClick={() => setCurrentTab("users")}>
            Quản lý thành viên
          </button>
          <button className={currentTab === "comics" ? "selected" : ""} onClick={() => setCurrentTab("comics")}>
            Quản lý truyện local
          </button>
          <button className={currentTab === "logs" ? "selected" : ""} onClick={() => setCurrentTab("logs")}>
            Nhật ký hoạt động
          </button>
          <button className={currentTab === "updates" ? "selected" : ""} onClick={() => setCurrentTab("updates")}>
            Cập nhật mới hôm nay
          </button>
          <button className={currentTab === "truyenqq-compare" ? "selected" : ""} onClick={() => setCurrentTab("truyenqq-compare")}>
            So sánh TruyenQQ
          </button>
        </div>

        {actionSuccess && (
          <div style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.4)", borderRadius: "8px", padding: "10px 14px", color: "#10b981", fontSize: "0.88rem", fontWeight: 600, marginBottom: "16px" }}>
            {actionSuccess}
          </div>
        )}
        {actionError && (
          <div style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: "8px", padding: "10px 14px", color: "#ef4444", fontSize: "0.88rem", fontWeight: 600, marginBottom: "16px" }}>
            {actionError}
          </div>
        )}

        {currentTab === "stats" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {statsLoading && <div>Đang tải thống kê hệ thống...</div>}
            {statsError && <div style={{ color: "#ef4444" }}>{statsError}</div>}
            {stats && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "16px" }}>
                <div style={{ background: "var(--surface-2)", border: "1px solid var(--line)", padding: "16px", borderRadius: "12px", textAlign: "center" }}>
                  <span style={{ display: "block", color: "var(--muted)", fontSize: "0.85rem", fontWeight: 500, marginBottom: "4px" }}>Thành viên đăng ký</span>
                  <strong style={{ fontSize: "2rem", color: "var(--ink)" }}>{stats.totalUsers}</strong>
                </div>
                <div style={{ background: "var(--surface-2)", border: "1px solid var(--line)", padding: "16px", borderRadius: "12px", textAlign: "center" }}>
                  <span style={{ display: "block", color: "var(--muted)", fontSize: "0.85rem", fontWeight: 500, marginBottom: "4px" }}>Truyện local (Import)</span>
                  <strong style={{ fontSize: "2rem", color: "var(--ink)" }}>{stats.importedComics}</strong>
                </div>
                <div style={{ background: "var(--surface-2)", border: "1px solid var(--line)", padding: "16px", borderRadius: "12px", textAlign: "center" }}>
                  <span style={{ display: "block", color: "var(--muted)", fontSize: "0.85rem", fontWeight: 500, marginBottom: "4px" }}>Phim trực tuyến (API)</span>
                  <strong style={{ fontSize: "2rem", color: "var(--gold,#f59e0b)" }}>{stats.onlineMovies}</strong>
                </div>
                <div style={{ background: "var(--surface-2)", border: "1px solid var(--line)", padding: "16px", borderRadius: "12px", textAlign: "center" }}>
                  <span style={{ display: "block", color: "var(--muted)", fontSize: "0.85rem", fontWeight: 500, marginBottom: "4px" }}>Truyện trực tuyến (API)</span>
                  <strong style={{ fontSize: "2rem", color: "var(--teal,#16a34a)" }}>{stats.onlineComics}</strong>
                </div>
              </div>
            )}
            <div style={{ marginTop: "12px", padding: "14px", borderRadius: "8px", background: "var(--surface-2)", border: "1px solid var(--line)", fontSize: "0.88rem", color: "var(--muted)" }}>
              Hệ thống nạp tự động liên kết nguồn dữ liệu trực tiếp qua OTruyen API và PhimAPI (Vsmov). Các tệp tin tải lên local được lưu trữ an toàn trong thư mục máy chủ.
            </div>
          </div>
        )}

        {currentTab === "users" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {usersLoading && <div>Đang tải danh sách thành viên...</div>}
            {usersError && <div style={{ color: "#ef4444" }}>{usersError}</div>}
            
            <div style={{ overflowX: "auto", maxHeight: "380px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem", textAlign: "left" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--line)", color: "var(--muted)" }}>
                    <th style={{ padding: "10px 8px" }}>Tài khoản</th>
                    <th style={{ padding: "10px 8px" }}>Mật khẩu</th>
                    <th style={{ padding: "10px 8px" }}>Tên hiển thị</th>
                    <th style={{ padding: "10px 8px" }}>Vai trò</th>
                    <th style={{ padding: "10px 8px" }}>Ngày tạo</th>
                    <th style={{ padding: "10px 8px", textAlign: "right" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} style={{ borderBottom: "1px solid var(--line)" }} className="admin-table-row">
                      <td style={{ padding: "10px 8px", fontWeight: 600 }}>@{u.username}</td>
                      <td style={{ padding: "10px 8px", color: "var(--muted)" }}>
                        {u.passwordPlain || <span style={{ fontStyle: "italic", fontSize: "0.78rem", opacity: 0.65 }}>Bảo mật (Bcrypt)</span>}
                      </td>
                      <td style={{ padding: "10px 8px" }}>{u.displayName || "-"}</td>
                      <td style={{ padding: "10px 8px" }}>
                        <span style={{
                          padding: "2px 6px",
                          borderRadius: "4px",
                          fontSize: "0.78rem",
                          fontWeight: 700,
                          background: u.role === "admin" ? "rgba(245,158,11,0.12)" : "rgba(22,163,74,0.12)",
                          color: u.role === "admin" ? "#d97706" : "#16a34a"
                        }}>
                          {u.role === "admin" ? "ADMIN" : "USER"}
                        </span>
                      </td>
                      <td style={{ padding: "10px 8px", color: "var(--muted)" }}>{formatDate(u.createdAt)}</td>
                      <td style={{ padding: "10px 8px", textAlign: "right" }}>
                        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                          <button
                            onClick={() => handleResetPassword(u)}
                            style={{
                              padding: "4px 8px",
                              borderRadius: "6px",
                              border: "1px solid var(--teal, #16a34a)",
                              background: "rgba(22,163,74,0.06)",
                              color: "var(--teal, #16a34a)",
                              cursor: "pointer",
                              fontSize: "0.8rem"
                            }}
                            title="Đặt lại mật khẩu cho thành viên"
                          >
                            Đổi MK
                          </button>
                          <button
                            onClick={() => handleToggleRole(u)}
                            disabled={u.id === authUser?.id || u.username.toLowerCase() === "admin"}
                            style={{
                              padding: "4px 8px",
                              borderRadius: "6px",
                              border: "1px solid var(--line)",
                              background: "var(--surface)",
                              color: "var(--ink)",
                              cursor: "pointer",
                              fontSize: "0.8rem",
                              opacity: (u.id === authUser?.id || u.username.toLowerCase() === "admin") ? 0.5 : 1
                            }}
                            title={u.role === "admin" ? "Hạ cấp xuống thành viên" : "Nâng cấp lên quản trị viên"}
                          >
                            {u.role === "admin" ? "Hạ cấp" : "Nâng quyền"}
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u)}
                            disabled={u.id === authUser?.id || u.username.toLowerCase() === "admin"}
                            style={{
                              padding: "4px 8px",
                              borderRadius: "6px",
                              border: "1px solid #ef4444",
                              background: "transparent",
                              color: "#ef4444",
                              cursor: "pointer",
                              fontSize: "0.8rem",
                              opacity: (u.id === authUser?.id || u.username.toLowerCase() === "admin") ? 0.5 : 1
                            }}
                            title="Xóa thành viên"
                          >
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!usersLoading && users.length === 0 && (
                <div style={{ textAlign: "center", padding: "20px", color: "var(--muted)" }}>
                  Không tìm thấy thành viên nào.
                </div>
              )}
            </div>
          </div>
        )}

        {currentTab === "comics" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {comicsLoading && <div>Đang tải danh sách truyện local...</div>}
            {comicsError && <div style={{ color: "#ef4444" }}>{comicsError}</div>}

            <div style={{ overflowX: "auto", maxHeight: "380px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem", textAlign: "left" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--line)", color: "var(--muted)" }}>
                    <th style={{ padding: "10px 8px" }}>Tên truyện</th>
                    <th style={{ padding: "10px 8px" }}>Tác giả</th>
                    <th style={{ padding: "10px 8px" }}>Trạng thái</th>
                    <th style={{ padding: "10px 8px" }}>Số chương</th>
                    <th style={{ padding: "10px 8px", textAlign: "right" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {comics.map((c) => (
                    <tr key={c.id} style={{ borderBottom: "1px solid var(--line)" }} className="admin-table-row">
                      <td style={{ padding: "10px 8px", fontWeight: 600 }}>{c.title}</td>
                      <td style={{ padding: "10px 8px" }}>{c.author || "Đang cập nhật"}</td>
                      <td style={{ padding: "10px 8px" }}>
                        <span style={{
                          padding: "2px 6px",
                          borderRadius: "4px",
                          fontSize: "0.78rem",
                          fontWeight: 700,
                          background: c.status === "completed" ? "rgba(22,163,74,0.12)" : "rgba(37,99,235,0.12)",
                          color: c.status === "completed" ? "#16a34a" : "#2563eb"
                        }}>
                          {STATUS_LABELS[c.status]}
                        </span>
                      </td>
                      <td style={{ padding: "10px 8px" }}>{c.totalChapters || 0}</td>
                      <td style={{ padding: "10px 8px", textAlign: "right" }}>
                        <button
                          onClick={() => handleDeleteComic(c)}
                          style={{
                            padding: "4px 8px",
                            borderRadius: "6px",
                            border: "1px solid #ef4444",
                            background: "transparent",
                            color: "#ef4444",
                            cursor: "pointer",
                            fontSize: "0.8rem"
                          }}
                          title="Xóa truyện tranh khỏi database local"
                        >
                          Xóa
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!comicsLoading && comics.length === 0 && (
                <div style={{ textAlign: "center", padding: "20px", color: "var(--muted)" }}>
                  Chưa có truyện local nào được import.
                </div>
              )}
            </div>
          </div>
        )}

        {currentTab === "logs" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {logsLoading && <div>Đang tải nhật ký hoạt động...</div>}
            {logsError && <div style={{ color: "#ef4444" }}>{logsError}</div>}
            {logsData && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div style={{ background: "var(--surface-2)", border: "1px solid var(--line)", padding: "12px", borderRadius: "8px", textAlign: "center" }}>
                    <span style={{ display: "block", color: "var(--muted)", fontSize: "0.82rem", marginBottom: "4px" }}>Tổng số yêu cầu hôm nay</span>
                    <strong style={{ fontSize: "1.4rem", color: "var(--ink)" }}>{formatNumber(logsData.todayStats.totalRequests)}</strong>
                  </div>
                  <div style={{ background: "var(--surface-2)", border: "1px solid var(--line)", padding: "12px", borderRadius: "8px", textAlign: "center" }}>
                    <span style={{ display: "block", color: "var(--muted)", fontSize: "0.82rem", marginBottom: "4px" }}>IP duy nhất hôm nay</span>
                    <strong style={{ fontSize: "1.4rem", color: "var(--teal,#16a34a)" }}>{formatNumber(logsData.todayStats.uniqueIPs)}</strong>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
                  <div style={{ background: "var(--surface-2)", border: "1px solid var(--line)", padding: "14px", borderRadius: "10px" }}>
                    <h3 style={{ fontSize: "0.9rem", fontWeight: 700, borderBottom: "1px solid var(--line)", paddingBottom: "6px", marginBottom: "8px", display: "flex", justifyContent: "space-between" }}>
                      <span>IP truy cập nhiều</span>
                      <small style={{ color: "#ef4444" }}>Lưu lượng</small>
                    </h3>
                    <div style={{ maxHeight: "150px", overflowY: "auto", fontSize: "0.82rem" }}>
                      {logsData.todayStats.topIPs.map((item) => (
                        <div key={item.ip} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px dashed var(--line)" }}>
                          <span style={{ color: item.count > 150 ? "#ef4444" : "var(--ink)", fontWeight: item.count > 150 ? "bold" : "normal" }}>{item.ip}</span>
                          <strong>{item.count} reqs</strong>
                        </div>
                      ))}
                      {logsData.todayStats.topIPs.length === 0 && <span style={{ color: "var(--muted)" }}>Không có dữ liệu</span>}
                    </div>
                  </div>

                  <div style={{ background: "var(--surface-2)", border: "1px solid var(--line)", padding: "14px", borderRadius: "10px" }}>
                    <h3 style={{ fontSize: "0.9rem", fontWeight: 700, borderBottom: "1px solid var(--line)", paddingBottom: "6px", marginBottom: "8px" }}>
                      Hoạt động nhiều hôm nay
                    </h3>
                    <div style={{ maxHeight: "150px", overflowY: "auto", fontSize: "0.82rem" }}>
                      {logsData.todayStats.topActivities.map((item, idx) => (
                        <div key={idx} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px dashed var(--line)" }}>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "160px" }} title={item.action}>{item.action}</span>
                          <strong>{item.count} lượt</strong>
                        </div>
                      ))}
                      {logsData.todayStats.topActivities.length === 0 && <span style={{ color: "var(--muted)" }}>Chưa có hoạt động nào</span>}
                    </div>
                  </div>

                  <div style={{ background: "var(--surface-2)", border: "1px solid var(--line)", padding: "14px", borderRadius: "10px" }}>
                    <h3 style={{ fontSize: "0.9rem", fontWeight: 700, borderBottom: "1px solid var(--line)", paddingBottom: "6px", marginBottom: "8px" }}>
                      Thành viên tích cực
                    </h3>
                    <div style={{ maxHeight: "150px", overflowY: "auto", fontSize: "0.82rem" }}>
                      {logsData.todayStats.activeUsers.map((item) => (
                        <div key={item.username} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px dashed var(--line)" }}>
                          <span>@{item.username}</span>
                          <strong>{item.count} reqs</strong>
                        </div>
                      ))}
                      {logsData.todayStats.activeUsers.length === 0 && <span style={{ color: "var(--muted)" }}>Chưa có hoạt động</span>}
                    </div>
                  </div>
                </div>

                <div>
                  <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "8px" }}>
                    Nhật ký truy cập gần đây (Cập nhật thời gian thực)
                  </h3>
                  <div style={{ overflowX: "auto", maxHeight: "200px", border: "1px solid var(--line)", borderRadius: "8px" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem", textAlign: "left" }}>
                      <thead>
                        <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--line)", color: "var(--muted)" }}>
                          <th style={{ padding: "6px 8px" }}>Thời gian</th>
                          <th style={{ padding: "6px 8px" }}>Địa chỉ IP</th>
                          <th style={{ padding: "6px 8px" }}>Thành viên</th>
                          <th style={{ padding: "6px 8px" }}>Hành động</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logsData.recentLogs.map((log, idx) => (
                          <tr key={idx} style={{ borderBottom: "1px solid var(--line)" }}>
                            <td style={{ padding: "6px 8px", color: "var(--muted)" }}>
                              {new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(log.timestamp))}
                            </td>
                            <td style={{ padding: "6px 8px" }}>{log.ip}</td>
                            <td style={{ padding: "6px 8px", fontWeight: log.username !== "Khách ẩn danh" ? "bold" : "normal" }}>
                              {log.username !== "Khách ẩn danh" ? `@${log.username}` : "Khách ẩn danh"}
                            </td>
                            <td style={{ padding: "6px 8px", color: "var(--muted)" }}>{log.action}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {currentTab === "updates" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <style>{`
              @keyframes pulse-dot-sync-green {
                0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
                70% { transform: scale(1); box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
                100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
              }
              @keyframes pulse-dot-sync-blue {
                0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); }
                70% { transform: scale(1); box-shadow: 0 0 0 8px rgba(59, 130, 246, 0); }
                100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
              }
              .pulse-dot-green {
                background: #10b981;
                border-radius: 50%;
                width: 10px;
                height: 10px;
                box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
                animation: pulse-dot-sync-green 2s infinite;
                display: inline-block;
              }
              .pulse-dot-blue {
                background: #3b82f6;
                border-radius: 50%;
                width: 10px;
                height: 10px;
                box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7);
                animation: pulse-dot-sync-blue 2s infinite;
                display: inline-block;
              }
            `}</style>

            <div style={{ background: "var(--surface-2)", border: "1px solid var(--line)", padding: "16px", borderRadius: "12px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
              <div style={{ flex: 1, minWidth: "260px" }}>
                <strong style={{ display: "block", fontSize: "0.95rem", color: "var(--ink)", marginBottom: "4px" }}>Trình cào truyện TruyenQQ</strong>
                <span style={{ fontSize: "0.8rem", color: "var(--muted)", display: "block", lineHeight: "1.3" }}>
                  Hệ thống tự động cập nhật 30 trang truyện mới mỗi giờ. Bạn có thể cào thêm theo số trang hoặc chạy cào toàn bộ. 1 trang tương đương khoảng 40 truyện.
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <label style={{ fontSize: "0.85rem", color: "var(--ink)", fontWeight: 600, display: "inline-flex", alignItems: "center" }}>
                  Số trang:
                  <input
                    type="number"
                    min="1"
                    max="600"
                    value={qqPages}
                    onChange={(e) => setQqPages(Math.max(1, parseInt(e.target.value) || 1))}
                    style={{ width: "70px", marginLeft: "6px", padding: "6px 8px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", textAlign: "center", fontWeight: "bold" }}
                  />
                </label>
                <button
                  onClick={() => handleTriggerQQSync(false)}
                  disabled={qqSyncLoading}
                  style={{ padding: "8px 16px", borderRadius: "8px", background: "var(--teal)", color: "#fff", fontWeight: 700, cursor: "pointer", opacity: qqSyncLoading ? 0.6 : 1, transition: "opacity 0.2s" }}
                >
                  {qqSyncLoading ? "Đang gửi..." : "Cào số trang"}
                </button>
                <button
                  onClick={() => {
                    if (window.confirm("Cào toàn bộ TruyenQQ có thể chạy rất lâu và tốn băng thông. Bạn muốn tiếp tục?")) handleTriggerQQSync(true);
                  }}
                  disabled={qqSyncLoading}
                  style={{ padding: "8px 16px", borderRadius: "8px", background: "#111827", color: "#fff", fontWeight: 700, cursor: "pointer", opacity: qqSyncLoading ? 0.6 : 1, transition: "opacity 0.2s" }}
                >
                  Cào toàn bộ
                </button>
              </div>
            </div>

            <div style={{ background: "var(--surface-2)", border: "1px solid var(--line)", padding: "16px", borderRadius: "12px", display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div className={qqSyncStatus?.isRunning ? "pulse-dot-green" : "pulse-dot-blue"} />
                  <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--ink)" }}>
                    {qqSyncStatus?.isRunning ? `Trình cào đang chạy (${qqSyncStatus.phase === "hot" ? "Cào truyện Hot" : "Cập nhật"})` : "Hệ thống tự động đồng bộ (Auto-sync) đang trực tuyến"}
                  </span>
                </div>
                <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                  Hoạt động cuối: {qqSyncStatus?.lastActiveTime ? new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(qqSyncStatus.lastActiveTime)) : "-"}
                </span>
              </div>

              {(() => {
                const total = qqEstimatedTotal || (qqSyncStatus?.totalPages ? qqSyncStatus.totalPages * 36 : 4320);
                const percent = Math.min(100, Math.round((qqLocalCount / total) * 100)) || 0;
                return (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginBottom: "6px", color: "var(--muted)" }}>
                      <span>Tỉ lệ kéo về database local:</span>
                      <strong style={{ color: "var(--teal)" }}>{qqLocalCount} / {total} truyện ({percent}%)</strong>
                    </div>
                    <div style={{ height: "10px", width: "100%", background: "rgba(255,255,255,0.08)", borderRadius: "6px", overflow: "hidden", border: "1px solid var(--line)" }}>
                      <div style={{ height: "100%", width: `${percent}%`, background: "linear-gradient(90deg, var(--teal), #10b981)", transition: "width 0.5s ease" }} />
                    </div>
                  </div>
                );
              })()}

              {qqSyncStatus?.isRunning && (
                <div style={{ background: "var(--surface)", border: "1px solid var(--line)", padding: "12px", borderRadius: "8px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "0.8rem" }}>
                  <div>
                    <span style={{ color: "var(--muted)", display: "block" }}>Trang hiện tại:</span>
                    <strong>Trang {qqSyncStatus.currentPage} / {qqSyncStatus.totalPages}</strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--muted)", display: "block" }}>Đang cào truyện:</span>
                    <strong style={{ color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }} title={qqSyncStatus.currentComic}>
                      {qqSyncStatus.currentComic || "Khởi tạo..."}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--muted)", display: "block" }}>Đã thêm mới:</span>
                    <strong style={{ color: "var(--teal)" }}>{qqSyncStatus.addedCount} truyện</strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--muted)", display: "block" }}>Đã cập nhật:</span>
                    <strong style={{ color: "var(--gold)" }}>{qqSyncStatus.updatedCount} truyện</strong>
                  </div>
                </div>
              )}
            </div>

            {updatesLoading && <div>Đang quét các cập nhật mới hôm nay...</div>}
            {updatesError && <div style={{ color: "#ef4444" }}>{updatesError}</div>}
            {updatesData && (
              <>
                <div style={{ padding: "12px", borderRadius: "8px", background: "var(--surface-2)", border: "1px solid var(--line)", fontSize: "0.88rem", color: "var(--muted)" }}>
                  Danh sách phim và truyện tranh được cập nhật chương mới/phần mới trong ngày hôm nay (**{formatDate(updatesData.todayDate)}**).
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div style={{ background: "var(--surface-2)", border: "1px solid var(--line)", padding: "14px", borderRadius: "10px" }}>
                    <h3 style={{ fontSize: "0.95rem", fontWeight: 700, borderBottom: "2px solid var(--line)", paddingBottom: "6px", marginBottom: "10px", color: "var(--gold,#f59e0b)" }}>
                      Phim mới cập nhật ({updatesData.onlineMovies.length})
                    </h3>
                    <div style={{ maxHeight: "300px", overflowY: "auto", fontSize: "0.85rem" }}>
                      {updatesData.onlineMovies.map((item, idx) => (
                        <div key={idx} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px dashed var(--line)", alignItems: "center" }}>
                          <span style={{ fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "220px" }} title={item.title}>
                            {item.title}
                          </span>
                          <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                            {item.info ? `(${item.info})` : ""}
                          </span>
                        </div>
                      ))}
                      {updatesData.onlineMovies.length === 0 && (
                        <div style={{ padding: "20px 0", textAlign: "center", color: "var(--muted)", fontStyle: "italic" }}>
                          Chưa ghi nhận phim mới cập nhật hôm nay.
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ background: "var(--surface-2)", border: "1px solid var(--line)", padding: "14px", borderRadius: "10px" }}>
                    <h3 style={{ fontSize: "0.95rem", fontWeight: 700, borderBottom: "2px solid var(--line)", paddingBottom: "6px", marginBottom: "10px", color: "var(--teal,#16a34a)" }}>
                      Truyện online cập nhật ({updatesData.onlineComics.length})
                    </h3>
                    <div style={{ maxHeight: "300px", overflowY: "auto", fontSize: "0.85rem" }}>
                      {updatesData.onlineComics.map((item, idx) => (
                        <div key={idx} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px dashed var(--line)", alignItems: "center" }}>
                          <span style={{ fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "220px" }} title={item.title}>
                            {item.title}
                          </span>
                          <span style={{ fontSize: "0.78rem", background: "rgba(22,163,74,0.12)", color: "#16a34a", padding: "2px 6px", borderRadius: "4px", fontWeight: "bold" }}>
                            {item.info}
                          </span>
                        </div>
                      ))}
                      {updatesData.onlineComics.length === 0 && (
                        <div style={{ padding: "20px 0", textAlign: "center", color: "var(--muted)", fontStyle: "italic" }}>
                          Chưa ghi nhận truyện online mới cập nhật hôm nay.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ background: "var(--surface-2)", border: "1px solid var(--line)", padding: "14px", borderRadius: "10px" }}>
                  <h3 style={{ fontSize: "0.95rem", fontWeight: 700, borderBottom: "2px solid var(--line)", paddingBottom: "6px", marginBottom: "10px" }}>
                    Truyện local (Import) cập nhật ({updatesData.localComics.length})
                  </h3>
                  <div style={{ maxHeight: "200px", overflowY: "auto", fontSize: "0.85rem" }}>
                    {updatesData.localComics.map((item, idx) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px dashed var(--line)", alignItems: "center" }}>
                        <span style={{ fontWeight: 600 }}>{item.title}</span>
                        <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{item.info}</span>
                      </div>
                    ))}
                    {updatesData.localComics.length === 0 && (
                      <div style={{ padding: "20px 0", textAlign: "center", color: "var(--muted)", fontStyle: "italic" }}>
                        Hôm nay không có truyện local nào được import thêm.
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {currentTab === "truyenqq-compare" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: "10px", padding: "14px 16px" }}>
              <h3 style={{ margin: "0 0 8px", fontSize: "1rem", fontWeight: 700 }}>So sánh TruyenQQ vs OTruyen API</h3>
              <p style={{ margin: "0 0 12px", fontSize: "0.85rem", color: "var(--muted)" }}>
                Crawl truyện mới cập nhật từ TruyenQQ và so sánh với OTruyen. Tốc độ chậm để tránh bị ban IP.
              </p>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {[3, 7, 10, 14].map(pages => (
                  <button
                    key={pages}
                    onClick={() => triggerTruyenQQCompare(pages)}
                    disabled={syncTriggering || syncData?.status === "running"}
                    style={{
                      padding: "7px 14px", borderRadius: "7px", border: "none",
                      background: syncTriggering || syncData?.status === "running" ? "var(--surface)" : "var(--accent,#6366f1)",
                      color: syncTriggering || syncData?.status === "running" ? "var(--muted)" : "#fff",
                      fontWeight: 700, cursor: syncTriggering || syncData?.status === "running" ? "not-allowed" : "pointer",
                      fontSize: "0.85rem"
                    }}
                  >
                    {syncTriggering ? "⏳ Đang khởi động..." : `Quét ${pages} trang gần đây`}
                  </button>
                ))}
                <button
                  onClick={loadTruyenQQCompare}
                  disabled={syncLoading}
                  style={{ padding: "7px 14px", borderRadius: "7px", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", fontWeight: 600, cursor: "pointer", fontSize: "0.85rem" }}
                >
                  {syncLoading ? "⏳ Đang tải..." : "Làm mới kết quả"}
                </button>
              </div>
            </div>

            {syncData?.status === "running" && (
              <div style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.4)", borderRadius: "8px", padding: "10px 14px", color: "#6366f1", fontSize: "0.88rem", fontWeight: 600 }}>
                ⏳ {syncData.progress}
              </div>
            )}
            {syncError && <div style={{ color: "#ef4444", fontSize: "0.88rem" }}>{syncError}</div>}

            {syncData?.lastRun && syncData.status !== "running" && (
              <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                Lần chạy cuối: {formatDateTime(syncData.lastRun)} - {syncData.progress}
              </div>
            )}

            {syncData?.results && syncData.results.length > 0 && (
              <div style={{ background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: "10px", overflow: "hidden" }}>
                <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)", display: "flex", gap: "16px", fontSize: "0.85rem", flexWrap: "wrap" }}>
                  <span style={{ color: "#ef4444", fontWeight: 700 }}>
                    ⚠️ Chậm hơn: {syncData.results.filter(r => r.diff > 0).length} truyện
                  </span>
                  <span style={{ color: "#10b981", fontWeight: 700 }}>
                    Đồng bộ: {syncData.results.filter(r => r.diff === 0).length} truyện
                  </span>
                  <span style={{ color: "var(--muted)", fontWeight: 600 }}>
                    Không tìm thấy: {syncData.results.filter(r => !r.matched).length} truyện
                  </span>
                </div>
                <div style={{ overflowY: "auto", maxHeight: "440px" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.83rem" }}>
                    <thead>
                      <tr style={{ background: "var(--surface)", position: "sticky", top: 0, zIndex: 1 }}>
                        <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, color: "var(--muted)", borderBottom: "1px solid var(--line)" }}>Tên truyện</th>
                        <th style={{ padding: "8px 10px", textAlign: "center", fontWeight: 700, color: "var(--muted)", borderBottom: "1px solid var(--line)" }}>TruyenQQ</th>
                        <th style={{ padding: "8px 10px", textAlign: "center", fontWeight: 700, color: "var(--muted)", borderBottom: "1px solid var(--line)" }}>OTruyen</th>
                        <th style={{ padding: "8px 10px", textAlign: "center", fontWeight: 700, color: "var(--muted)", borderBottom: "1px solid var(--line)" }}>Chênh lệch</th>
                        <th style={{ padding: "8px 10px", textAlign: "center", fontWeight: 700, color: "var(--muted)", borderBottom: "1px solid var(--line)" }}>Link</th>
                      </tr>
                    </thead>
                    <tbody>
                      {syncData.results.map((item, idx) => (
                        <tr
                          key={idx}
                          style={{
                            borderBottom: "1px solid var(--line)",
                            background: item.diff > 0 ? "rgba(239,68,68,0.05)" : item.diff === 0 ? "rgba(16,185,129,0.04)" : "transparent"
                          }}
                        >
                          <td style={{ padding: "7px 10px", fontWeight: 600, color: "var(--ink)" }}>
                            {item.title}
                            {item.truyenqqUpdated && (
                              <small style={{ display: "block", color: "var(--muted)", fontWeight: 400 }}>{item.truyenqqUpdated}</small>
                            )}
                          </td>
                          <td style={{ padding: "7px 10px", textAlign: "center", fontWeight: 700, color: "#6366f1" }}>
                            Chap {item.truyenqqChap || "?"}
                          </td>
                          <td style={{ padding: "7px 10px", textAlign: "center", color: item.matched ? "var(--ink)" : "var(--muted)", fontStyle: item.matched ? "normal" : "italic" }}>
                            {item.matched ? `Chap ${item.otruyenChap ?? "?"}` : "Không tìm thấy"}
                          </td>
                          <td style={{ padding: "7px 10px", textAlign: "center" }}>
                            {item.diff > 0 ? (
                              <span style={{ background: "#ef4444", color: "#fff", padding: "2px 8px", borderRadius: "12px", fontWeight: 700, fontSize: "0.8rem" }}>
                                +{item.diff} chap
                              </span>
                            ) : item.diff === 0 ? (
                              <span style={{ color: "#10b981", fontWeight: 700 }}>Đồng bộ</span>
                            ) : (
                              <span style={{ color: "var(--muted)" }}></span>
                            )}
                          </td>
                          <td style={{ padding: "7px 10px", textAlign: "center" }}>
                            <a href={item.truyenqqUrl} target="_blank" rel="noreferrer"
                              style={{ color: "#6366f1", fontSize: "0.78rem", textDecoration: "none", fontWeight: 600 }}>
                              Xem
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {syncData && !syncData.results?.length && syncData.status !== "running" && (
              <div style={{ textAlign: "center", color: "var(--muted)", padding: "40px 0", fontStyle: "italic" }}>
                Chưa có kết quả. Nhấn nút "Quét" ở trên để bắt đầu.
              </div>
            )}
          </div>
        )}
      </div>
  );

  if (embedded) {
    return <main className="page account-page admin-page">{content}</main>;
  }

  return (
    <div className="auth-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      {content}
    </div>
  );
}
