import type { AvatarFrameReward, ComicStatus } from "../types";

export const ACCOUNT_COMICS_PER_PAGE = 30;

export const COMMENT_STICKERS = Array.from({ length: 12 }, (_, index) => {
  const id = `qq-${String(index + 1).padStart(2, "0")}`;
  return { id, src: `/stickers/truyenqq/${id}.gif` };
});

export const READER_LEVELS = [
  "Phàm nhân",
  "Luyện Khí",
  "Trúc Cơ",
  "Kết Đan",
  "Nguyên Anh",
  "Hóa Thần",
  "Luyện Hư",
  "Hợp Thể",
  "Đại Thừa",
  "Độ Kiếp",
  "Chân Tiên",
  "Kim Tiên",
  "Thái Ất Tiên",
  "Đại La Tiên",
  "Thần Giới Chủ"
];

export const READER_LEVEL_XP = [0, 10, 30, 100, 150, 200, 250, 300, 500, 1000, 1500, 3000, 6000, 9000, 15000];

export const AVATAR_FRAME_NONE = "none";
export const AVATAR_FRAME_REWARDS: AvatarFrameReward[] = [
  { id: AVATAR_FRAME_NONE, label: "Tắt khung", unlockLevel: 0, cssClass: "no-frame" },
  { id: "admin-gold", label: "Admin", unlockLevel: 14, adminOnly: true, video: "/frames/admin_alpha.webm?v=4", cssClass: "frame-video admin-avatar-frame" },
  { id: "pham-nhan", label: "Phàm nhân", unlockLevel: 0, image: "/frames/phamnhan-centered.png?v=2", cssClass: "frame-image pham-nhan-frame" },
  { id: "ket-dan", label: "Kết Đan", unlockLevel: 3, cssClass: "frame-level-3" },
  { id: "luyen-hu", label: "Luyện Hư", unlockLevel: 6, cssClass: "frame-level-6" },
  { id: "do-kiep", label: "Độ Kiếp", unlockLevel: 9, cssClass: "frame-level-9" },
  { id: "thai-at-tien", label: "Thái Ất Tiên", unlockLevel: 12, cssClass: "frame-level-12" },
  { id: "than-gioi-chu", label: "Thần Giới Chủ", unlockLevel: 14, cssClass: "frame-level-14" },
  { id: "top1-doc-truyen", label: "Top 1 đọc truyện", unlockLevel: 14, video: "/frames/top1_doctruyen_alpha.webm?v=3", cssClass: "frame-video top1-reader-frame" }
];

export const MOBILE_COMIC_GENRES = [
  { name: "Action", slug: "action-26" },
  { name: "Adventure", slug: "adventure-27" },
  { name: "Anime", slug: "anime-62" },
  { name: "Chuyển Sinh", slug: "chuyen-sinh-91" },
  { name: "Cổ Đại", slug: "co-dai-90" },
  { name: "Comedy", slug: "comedy-28" },
  { name: "Comic", slug: "comic-60" },
  { name: "Demons", slug: "demons-99" },
  { name: "Detective", slug: "detective-100" },
  { name: "Doujinshi", slug: "doujinshi-96" },
  { name: "Drama", slug: "drama-29" },
  { name: "Fantasy", slug: "fantasy-30" },
  { name: "Gender Bender", slug: "gender-bender-45" },
  { name: "Harem", slug: "harem-47" },
  { name: "Historical", slug: "historical-51" },
  { name: "Horror", slug: "horror-44" },
  { name: "Huyền Huyễn", slug: "huyen-huyen-468" },
  { name: "Isekai", slug: "isekai-85" },
  { name: "Josei", slug: "josei-54" },
  { name: "Mafia", slug: "mafia-69" },
  { name: "Magic", slug: "magic-58" },
  { name: "Manga", slug: "manga-469" },
  { name: "Manhua", slug: "manhua-35" },
  { name: "Manhwa", slug: "manhwa-49" },
  { name: "Martial Arts", slug: "martial-arts-41" },
  { name: "Military", slug: "military-101" },
  { name: "Mystery", slug: "mystery-39" },
  { name: "Ngôn Tình", slug: "ngon-tinh-87" },
  { name: "One shot", slug: "one-shot-95" },
  { name: "Psychological", slug: "psychological-40" },
  { name: "Romance", slug: "romance-36" },
  { name: "School Life", slug: "school-life-37" },
  { name: "Sci-fi", slug: "sci-fi-43" },
  { name: "Seinen", slug: "seinen-42" },
  { name: "Shoujo", slug: "shoujo-38" },
  { name: "Shounen", slug: "shounen-31" },
  { name: "Slice of life", slug: "slice-of-life-46" },
  { name: "Sports", slug: "sports-57" },
  { name: "Supernatural", slug: "supernatural-32" },
  { name: "Trọng Sinh", slug: "trong-sinh-82" },
  { name: "Truyện Màu", slug: "truyen-mau-92" },
  { name: "Webtoon", slug: "webtoon-55" },
  { name: "Xuyên Không", slug: "xuyen-khong-88" }
];

export const MOBILE_RANKING_LINKS = [
  "Top Ngày",
  "Top Tuần",
  "Top Tháng",
  "Yêu Thích",
  "Mới Cập Nhật",
  "Truyện Mới",
  "Truyện Full",
  "Truyện Ngẫu Nhiên"
];

export const COMIC_DETAIL_COMMENTS_CHAPTER = "__comic_detail__";

export const STATUS_LABELS: Record<ComicStatus, string> = {
  ongoing: "Đang ra",
  completed: "Hoàn thành",
  paused: "Tạm dừng"
};
