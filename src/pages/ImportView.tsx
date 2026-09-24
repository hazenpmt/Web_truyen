import { Check, ChevronLeft, DownloadCloud, Upload, UploadCloud } from "lucide-react";
import { useState } from "react";
import { importManifest } from "../api";
import { Notice } from "../components/common/UIComponents";
import type { CatalogSource } from "../types";
import { navigate } from "../utils/routing";

const sampleManifest = {
  title: "Truyện Demo Import",
  author: "Tác giả của bạn",
  description: "Manifest mẫu dùng asset nội bộ. Khi nhập nguồn thật, thay coverUrl và pages bằng URL ảnh bạn có quyền sử dụng.",
  status: "ongoing",
  genres: ["Phiêu lưu", "Demo"],
  coverUrl: "/sample/covers/neon-district.svg",
  source: {
    name: "Nguồn hợp lệ của bạn",
    license: "Owned or licensed"
  },
  chapters: [
    {
      title: "Chương 1: Bắt đầu",
      number: 1,
      pages: ["/sample/pages/neon-district-1.svg", "/sample/pages/neon-district-2.svg"]
    }
  ]
};

export function ImportView() {
  const [mode, setMode] = useState<"json" | "url">("json");
  const [manifestUrl, setManifestUrl] = useState("");
  const [manifestText, setManifestText] = useState(() => JSON.stringify(sampleManifest, null, 2));
  const [confirmRights, setConfirmRights] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit() {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const result = await importManifest(
        mode === "url"
          ? { manifestUrl, confirmRights }
          : {
              manifest: JSON.parse(manifestText),
              confirmRights
            }
      );
      setSuccess(`Đã import ${result.comic.title}.`);
      navigate(`/comic/${result.comic.slug}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Import thất bại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <section className="import-band">
        <div>
          <button className="back-link" onClick={() => navigate("/")}>
            <ChevronLeft size={18} />
            <span>Kho truyện</span>
          </button>
          <p className="eyebrow">Nạp truyện</p>
          <h1>Import bằng manifest JSON</h1>
          <p className="muted-line">Chỉ dùng truyện bạn tự sở hữu, được cấp phép, hoặc có quyền phân phối.</p>
        </div>
        <div className="import-status">
          <Check size={18} />
          <span>Lưu ảnh vào public/uploads</span>
        </div>
      </section>

      <section className="import-tool">
        <div className="segment compact" role="group" aria-label="Kiểu nhập">
          <button className={mode === "json" ? "selected" : ""} onClick={() => setMode("json")}>
            JSON
          </button>
          <button className={mode === "url" ? "selected" : ""} onClick={() => setMode("url")}>
            URL
          </button>
        </div>

        {mode === "url" ? (
          <label className="field">
            <span>Manifest URL</span>
            <input value={manifestUrl} onChange={(event) => setManifestUrl(event.target.value)} placeholder="https://domain-cua-ban/truyen.json" />
          </label>
        ) : (
          <label className="field">
            <span>Manifest JSON</span>
            <textarea value={manifestText} onChange={(event) => setManifestText(event.target.value)} spellCheck={false} />
          </label>
        )}

        <label className="check-row">
          <input type="checkbox" checked={confirmRights} onChange={(event) => setConfirmRights(event.target.checked)} />
          <span>Tôi xác nhận có quyền sử dụng và phân phối nội dung trong manifest này.</span>
        </label>

        {error && <Notice tone="error" message={error} />}
        {success && <Notice tone="success" message={success} />}

        <button className="primary-action wide" disabled={busy} onClick={submit}>
          <UploadCloud size={18} />
          <span>{busy ? "Đang import..." : "Import truyện"}</span>
        </button>
      </section>
    </main>
  );
}
