#  Multi-Source Comic & Media Platform (Web Đọc Truyện & Xem Phim Đa Nguồn)

> **Dự án Full-stack Web Đọc Truyện Tranh & Xem Phim tích hợp API Đa Nguồn, Tối ưu hóa Hiệu năng và Trải nghiệm Người dùng.**

Link Demo:https://web-truyen-wt3c.onrender.com/


## 🌟 Giới thiệu Dự án

**Web Truyện & Phim Aggregator** là ứng dụng web full-stack giúp người dùng có thể **đọc truyện tranh** và **xem phim trực tuyến** mượt mà từ nhiều nguồn khác nhau. 

Dự án được xây dựng với mục tiêu giải quyết các bài toán thực tế trong phát triển Web:
- **Xử lý bất đồng bộ & Tối ưu giao diện**: Tách nhỏ giao diện thành dạng Component độc lập (Modular Architecture), tải ảnh thông minh (Optimized Image Proxy).
- **Bypass CORS & Anti-Hotlinking**: Tự viết Middleware trên Server trung gian để tải được ảnh từ các nguồn CDN có bảo mật.
- **Hệ thống tương tác (Gamification)**: Cấp độ người dùng (XP Level), Khung Avatar động, Lịch sử đọc truyện và Bình luận nhãn dán.

---

## 🛠️ Công Nghệ Sử Dụng (Tech Stack)

### Frontend (Giao diện)
- **React 18** & **TypeScript**: Xây dựng giao diện Type-safe, quản lý State chặt chẽ.
- **Vite**: Công cụ build ứng dụng siêu nhanh.
- **Vanilla CSS**: Tùy chỉnh giao diện Glassmorphism hiện đại, Dark mode, tương thích hoàn toàn trên cả Mobile & Desktop.

### Backend (Máy chủ API & Proxy)
- **Node.js** & **Express.js**: Xây dựng RESTful API, quản lý dữ liệu và xử lý request.
- **JWT (JSON Web Token)**: Xác thực đăng nhập và phân quyền người dùng (User / Admin).
- **Cheerio & Axios**: Crawl và đồng bộ dữ liệu metadata tự động.

---

## ✨ Các Tính Năng Nổi Bật

1. 📖 **Đọc Truyện Tranh Đa Nguồn**:
   - Chế độ đọc dọc/cuộn trang mượt mà trên cả điện thoại và máy tính.
   - Hỗ trợ đổi máy chủ ảnh (OTruyen, TruyenQQ, Nguồn nội bộ).
   - Lưu lịch sử đọc truyện tự động.

2. 🎬 **Xem Phim Trực Tuyến**:
   - Tích hợp trình phát video nhúng (Embed player) hỗ trợ xem phim HD.
   - Tìm kiếm và lọc phim theo thể loại, quốc gia, năm phát hành.

3. 👤 **Hệ Thống Tài Khoản & Gamification**:
   - Đăng ký, Đăng nhập bảo mật với Token JWT.
   - Hệ thống tính điểm kinh nghiệm (XP) & Level theo thời gian đọc truyện thực tế.
   - Khung Avatar động đẹp mắt (MP4/WebM frame).

4. 🔍 **Tìm Kiếm & Lọc Thông Minh**:
   - Tìm kiếm tức thì với cơ chế Debounce (tránh spam request đến Server).
   - Lọc theo thể loại, trạng thái hoàn thành và lượt xem.

---

## 📐 Điểm Nổi Bật Về Kĩ Thuật (Technical Highlights)

- **Kiến trúc Code Clean & Modular**: Codebase được tái cấu trúc sạch sẽ theo các thư mục `components/`, `pages/`, `hooks/`, `utils/`, `types.ts`, không bị lộn xộn.
- **Image Proxy Caching Middleware**: Giải quyết triệt để lỗi 403 Forbidden / CORS khi tải ảnh từ server truyện bên thứ 3.
- **100% Type-Safe**: Đảm bảo không có lỗi ép kiểu runtime nhờ TypeScript Strict Mode.
