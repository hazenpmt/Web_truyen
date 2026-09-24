# Web Truyện

Web đọc truyện tranh full-stack bằng React + Vite và Express.

## Chạy local

```bash
npm install
npm run dev
```

- Web: `http://localhost:5173`
- API: `http://localhost:3001`
- Dữ liệu truyện: `data/comics_index.json` và `data/comics/*.json`
- Ảnh import: `public/uploads`

## TruyenQQ: full crawl trên PC, auto cập nhật trên VPS

Full crawl nên chạy trên PC trước để tránh VPS 1 CPU/1GB bị nặng trong lần đầu:

```bash
npm install
npm run crawl:truyenqq:all
```

Nếu chỉ muốn thử nhanh vài trang:

```bash
npm run crawl:truyenqq -- 5
```

Nếu đang crawl dở và muốn chạy nhanh hơn trên PC, dừng crawler rồi chạy tiếp từ page đang dở:

```bash
npm run crawl:truyenqq:fast -- --from 155
```

Chế độ `fast` chỉ áp dụng cho lệnh đó. Chạy `npm run crawl:truyenqq:all` sẽ quay lại tốc độ mặc định an toàn hơn.

Sau khi full crawl xong, deploy/copy thư mục `data/` lên VPS cùng code. Khi chạy trên VPS, chỉ bật auto cập nhật các trang mới:

```bash
ENABLE_TRUYENQQ_AUTO_SYNC=1
TRUYENQQ_INITIAL_SYNC_PAGES=3
TRUYENQQ_INTERVAL_SYNC_PAGES=3
```

`deploy.sh` đã dùng cấu hình này và chạy backend bằng `dist-server/index.js` để tiết kiệm RAM/CPU. Full crawl chỉ lấy metadata và danh sách chapter; ảnh chapter sẽ được proxy/cache khi người đọc mở chapter để tránh tải trước quá nhiều dữ liệu.

## Chế độ đọc truyện và xem phim

Topbar có công tắc:

- `Đọc truyện`: dùng OTruyen API mặc định, vẫn có thể chuyển sang kho local.
- `Xem phim`: dùng VSMOV API để lấy danh sách phim, chi tiết phim và `link_embed` của tập phim.

Route chính:

- `/#/` - kho truyện.
- `/#/api-comic/:slug` - chi tiết truyện từ OTruyen API.
- `/#/api-read/:slug/:chapterKey` - đọc chapter từ OTruyen CDN.
- `/#/movies` - kho phim.
- `/#/movie/:slug` - trang xem phim từ VSMOV API.

Proxy API mới:

- `GET /api/providers/comics`
- `GET /api/providers/comics/meta`
- `GET /api/providers/comics/:slug`
- `GET /api/providers/comics/:slug/chapters/:chapterKey`
- `GET /api/providers/movies`
- `GET /api/providers/movies/:slug`

## Import truyện

Màn `Import` nhận manifest JSON hoặc URL trỏ tới manifest JSON. Chỉ dùng nội dung bạn sở hữu, được cấp phép, hoặc có quyền phân phối.

```json
{
  "title": "Tên truyện",
  "author": "Tác giả",
  "description": "Mô tả ngắn",
  "status": "ongoing",
  "genres": ["Phiêu lưu", "Hành động"],
  "coverUrl": "https://domain-cua-ban/cover.jpg",
  "source": {
    "name": "Nguồn hợp lệ",
    "license": "Owned or licensed"
  },
  "chapters": [
    {
      "title": "Chương 1",
      "number": 1,
      "pages": [
        "https://domain-cua-ban/page-1.jpg",
        "https://domain-cua-ban/page-2.jpg"
      ]
    }
  ]
}
```

Importer sẽ tải ảnh `http/https` về `public/uploads/<slug-truyen>/` và lưu metadata vào `data/comics_index.json` + `data/comics/*.json`.

## Crawler học tập hợp lệ

Tab `Crawler` dùng để học cách lấy dữ liệu từ HTML có cấu trúc khi bạn có quyền crawl nguồn đó.

Crawler hiện có các giới hạn:

- Bắt buộc xác nhận quyền sử dụng nội dung.
- Kiểm tra `robots.txt` trước khi tải trang HTML và ảnh.
- Rate limit khoảng 900ms giữa các chapter.
- Tối đa 10 chương mỗi lần crawl.
- Tối đa 80 ảnh mỗi chương.
- Không có logic bypass đăng nhập, CAPTCHA, paywall hoặc chống scrape.

Các selector cần nhập:

```json
{
  "startUrl": "https://domain-cua-ban/truyen-a",
  "selectors": {
    "title": "h1",
    "author": ".author",
    "description": ".description",
    "cover": ".cover img",
    "genres": ".genres a",
    "chapterLinks": ".chapter-list a",
    "chapterTitle": "h1",
    "pageImages": ".reader img"
  },
  "maxChapters": 3,
  "license": "Owned or licensed",
  "confirmRights": true
}
```

Nếu muốn crawl nguồn thật, hãy dùng website của bạn, nguồn public domain/Creative Commons, hoặc nguồn đã được cấp phép rõ ràng.
