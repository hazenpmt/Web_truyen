import { BookOpen, Clapperboard, Eye, Film, Layers3, Play, Search } from "lucide-react";
import { OptimizedImage } from "../components/common/OptimizedImage";

export function UIPreviewView() {
  const covers = [
    "/sample/covers/sky-market.svg",
    "https://img.otruyenapi.com/uploads/comics/witchriv-thumb.jpg",
    "/sample/covers/neon-district.svg",
    "https://vsmov.com/storage/movies/moi-quan-he-bi-mat/moi-quan-he-bi-mat-thumb.jpg"
  ];

  return (
    <main className="preview-page">
      <section className="preview-hero">
        <div>
          <p className="eyebrow">UI preview</p>
          <h1>Chọn hướng giao diện trước khi thay UI chính</h1>
          <p>Ba concept dưới đây là mockup chạy bằng HTML/CSS thật trong app hiện tại.</p>
        </div>
        <button className="primary-action" onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })}>
          <Eye size={18} />
          <span>Xem concept</span>
        </button>
      </section>

      <section className="preview-concept manga-concept">
        <div className="concept-copy">
          <span>Concept A</span>
          <h2>Manga Stream</h2>
          <p>Giao diện sáng, đầy đủ thông tin, hợp kho truyện lớn: dễ quét chapter, thể loại, trạng thái và đọc tiếp.</p>
        </div>
        <div className="manga-shell">
          <aside>
            <strong>TruyenHub</strong>
            <button className="selected">Khám phá</button>
            <button>Đang theo dõi</button>
            <button>Lịch sử</button>
          </aside>
          <div className="manga-content">
            <div className="manga-toolbar">
              <label>
                <Search size={16} />
                <span>Tìm One Piece, Solo Leveling...</span>
              </label>
              <button>OTruyen API</button>
            </div>
            <div className="manga-feature">
              <OptimizedImage src={covers[1]} alt="Witchriv preview" />
              <div>
                <span>Đang phát hành</span>
                <h3>Witchriv</h3>
                <p>27 chương - Action - cập nhật hôm nay</p>
                <div>
                  <button>Đọc tiếp</button>
                  <button>Theo dõi</button>
                </div>
              </div>
            </div>
            <div className="mini-comic-grid">
              {covers.slice(0, 3).map((cover, index) => (
                <article key={cover}>
                  <OptimizedImage src={cover} alt={`Preview manga ${index + 1}`} />
                  <strong>{["Chợ Trời Sao Bắc", "Witchriv", "Quận Neon Số 7"][index]}</strong>
                  <span>{[30, 27, 12][index]} chương</span>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="preview-concept cinema-concept">
        <div className="concept-copy">
          <span>Concept B</span>
          <h2>Cinema Dark</h2>
          <p>Ưu tiên trải nghiệm xem phim: nền tối, poster lớn, tập phim rõ, player nổi bật và ít chi tiết gây nhiễu.</p>
        </div>
        <div className="cinema-shell">
          <div className="cinema-player">
            <OptimizedImage src="https://vsmov.com/storage/movies/moi-quan-he-bi-mat/moi-quan-he-bi-mat-poster.jpg" alt="Movie preview" />
            <button>
              <Play size={24} fill="currentColor" />
            </button>
          </div>
          <div className="cinema-info">
            <span>VSMOV API - HD Vietsub</span>
            <h3>Mối Quan Hệ Bí Mật</h3>
            <p>Không tự load player khi mở trang, chỉ phát khi người dùng chọn tập để giảm lag.</p>
            <div className="episode-preview-row">
              {["Tập 1", "Tập 2", "Tập 9", "Tập 10"].map((episode, index) => (
                <button className={index === 0 ? "selected" : ""} key={episode}>
                  {episode}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="preview-concept hybrid-concept">
        <div className="concept-copy">
          <span>Concept C</span>
          <h2>Hybrid Library</h2>
          <p>Giao diện gọn cho cả truyện và phim: ít màu hơn, menu rõ, card đồng nhất, phù hợp dùng lâu dài.</p>
        </div>
        <div className="hybrid-shell">
          <div className="hybrid-top">
            <strong>Library</strong>
            <div>
              <button className="selected">
                <BookOpen size={16} />
                Truyện
              </button>
              <button>
                <Clapperboard size={16} />
                Phim
              </button>
            </div>
          </div>
          <div className="hybrid-body">
            <div className="hybrid-panel">
              <Layers3 size={20} />
              <strong>26,585 truyện</strong>
              <span>OTruyen API</span>
            </div>
            <div className="hybrid-panel">
              <Film size={20} />
              <strong>17,340 phim</strong>
              <span>VSMOV API</span>
            </div>
            <div className="hybrid-list">
              {["Đọc tiếp Witchriv - Chương 12", "Theo dõi One Piece", "Bình luận mới", "Đánh giá 4/5"].map((item) => (
                <div key={item}>
                  <span />
                  <strong>{item}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
