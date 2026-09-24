# TÀI LIỆU BÀN GIAO DỰ ÁN & HƯỚNG DẪN TỐI ƯU HIỆU NĂNG WEB TRUYỆN

> **Dành cho AI ở phiên chat mới:** Hãy đọc kỹ tài liệu này để hiểu toàn bộ ngữ cảnh dự án, kiến trúc hiện tại, nguyên nhân lỗi quá tải hệ thống (CPU/RAM 100% trên VPS 1GB RAM) và hướng dẫn triển khai giải pháp tối ưu hóa triệt để.

---

## 1. TỔNG QUAN DỰ ÁN & CÔNG NGHỆ ĐÃ DÙNG (TECH STACK)

Dự án là một trang web đọc truyện tranh và xem phim Full-Stack. Người dùng có thể đọc truyện lấy trực tiếp từ API bên ngoài, hoặc đọc truyện đã được crawler tải về kho lưu trữ cục bộ (Local).

*   **Frontend**: 
    *   **Công nghệ**: React (Single Page Application - SPA), TypeScript, Vite (build tool).
    *   **Routing**: React Router sử dụng chế độ Hash (`HashRouter` với tiền tố `/#/`).
    *   **Styling**: CSS thuần (`src/styles.css`), giao diện hiện đại hỗ trợ Dark Mode.
    *   **Kiến trúc**: Toàn bộ giao diện UI của các trang (Trang chủ, Chi tiết truyện, Đọc chương, Quản trị Admin, Đăng ký/Đăng nhập) đều được gộp chung trong một file lớn duy nhất là [App.tsx](file:///d:/Web_truyen/src/App.tsx) (~200KB).
    *   **API Client**: File [api.ts](file:///d:/Web_truyen/src/api.ts) chứa các hàm giao tiếp với Backend hoặc fetch trực tiếp API bên thứ ba.
*   **Backend**: 
    *   **Công nghệ**: Node.js, Express, TypeScript (chạy trực tiếp bằng công cụ `tsx watch`).
    *   **Cơ chế Web Crawler**: Dùng thư viện `cheerio` để cào (parse) HTML từ nguồn ngoài (như TruyenQQ).
    *   **Xác thực người dùng**: JWT (JSON Web Token), mã hóa mật khẩu bằng `bcryptjs`.
*   **Cơ sở dữ liệu (Database)**:
    *   Hệ thống **không dùng** các hệ quản trị CSDL như MySQL hay MongoDB.
    *   Toàn bộ dữ liệu được lưu dưới dạng các **file JSON phẳng** (Flat JSON files) đặt trong thư mục [data/](file:///d:/Web_truyen/data):
        *   `data/comics.json`: Lưu trữ toàn bộ thông tin truyện tranh local (metadata, danh sách chương, danh sách các trang ảnh của từng chương).
        *   `data/users.json`: Lưu trữ thông tin tài khoản người dùng, vai trò (admin/user), lịch sử đọc truyện, truyện theo dõi.
        *   `data/access_logs.json`: Nhật ký truy cập hệ thống phục vụ hiển thị biểu đồ trang Admin.

---

## 2. NHỮNG GÌ ĐÃ LÀM ĐƯỢC (CURRENT FEATURES)

1.  **Đọc truyện Online**: Tích hợp API của `OTruyen` và `TruyenQQ` cho phép tìm kiếm, lọc thể loại, xem chi tiết và đọc chương truyện trực tiếp từ nguồn ngoài (sử dụng proxy ảnh để tránh lỗi chặn Referer).
2.  **Xem phim Online**: Tích hợp API của `VSMOV` hiển thị danh sách phim lẻ, phim bộ, chi tiết phim và xem phim trực tuyến qua link iframe embed.
3.  **Crawler truyện (Sync)**: 
    *   Tính năng cào truyện từ TruyenQQ về kho Local.
    *   Tự động phát hiện chương mới và cào ngầm.
    *   Khi người dùng bấm đọc một chương truyện Local mà chưa được tải trước trang ảnh, server sẽ kích hoạt cơ chế *Live Fetch* để tải danh sách ảnh từ nguồn gốc rồi lưu ngay vào database.
4.  **Import truyện thủ công**: Cho phép quản trị viên import truyện bằng file manifest JSON cấu trúc sẵn. Ảnh chương truyện sẽ được tải về thư mục cục bộ [public/uploads/](file:///d:/Web_truyen/public/uploads/).
5.  **Hệ thống Thành viên & Admin**: 
    *   Đăng ký, đăng nhập, phân quyền Admin.
    *   Lưu lịch sử đọc truyện, danh sách theo dõi đồng bộ giữa Client và Server.
    *   Trang quản trị (Admin Dashboard) hiển thị biểu đồ thống kê truy cập hàng ngày, quản lý tài khoản người dùng, điều khiển crawler đồng bộ truyện.

---

## 3. VẤN ĐỀ HIỆU NĂNG NGHIÊM TRỌNG: CPU/RAM LÊN 100% GÂY LAG, CRASH

### A. Mô tả hiện tượng
Khi người dùng truy cập trang chủ kho truyện Local, bấm xem chi tiết truyện, hoặc bấm đọc chương truyện, VPS bị đơ hoàn toàn (CPU và RAM vọt lên 100%), phản hồi API bị nghẽn (fail request hoặc load cực kỳ chậm), người dùng phải F5 liên tục mới có thể hiển thị được dữ liệu.

### B. Nguyên nhân gốc rễ (Root Cause Analysis)

1.  **Database JSON duy nhất quá lớn (93.3 MB)**:
    *   File `data/comics.json` hiện tại nặng tới **93.3 MB** chứa thông tin của **4.375 bộ truyện tranh**.
    *   Cấu trúc dữ liệu của file này gom chung toàn bộ Metadata truyện + Mảng `chapters` (danh sách chương) + Mảng `pages` (chứa hàng chục link ảnh của từng chương). 
    *   Với hơn 4.300 truyện, số lượng chương lên tới hơn 320.000 chương. Việc lưu trữ mảng ảnh của toàn bộ các chương này vào một file JSON duy nhất làm kích thước file phình to quá mức kiểm soát.
2.  **Quá tải CPU/RAM do `JSON.parse` và `JSON.stringify` liên tục**:
    *   Mỗi khi có yêu cầu API lấy danh sách truyện, xem chi tiết, hoặc đọc chương, server gọi `readComics()` để đọc file `comics.json`. Việc chạy `JSON.parse` trên chuỗi string 93MB ngốn cực kỳ nhiều CPU và chiếm dụng hàng trăm MB bộ nhớ RAM (RAM Heap của Node.js tăng vọt).
    *   Khi crawler chạy ngầm cập nhật truyện mới, hoặc khi người dùng đọc một chương truyện chưa có ảnh (live fetch ảnh), server gọi `writeComics(comics)`. Hàm này chạy `JSON.stringify` trên toàn bộ 4.375 truyện và ghi đè xuống ổ cứng. Quá trình chuyển đổi mảng lớn sang chuỗi JSON block hoàn toàn CPU của Node.js (luồng đơn) từ 2-5 giây và làm RAM vọt lên gấp 3-4 lần dung lượng file.
    *   Tệ hơn nữa, crawler trong [sync.ts](file:///d:/Web_truyen/server/sync.ts) gọi `writeComics(comics)` **trong vòng lặp** khi đồng bộ nhiều truyện. Nếu có 10 truyện mới, server sẽ chạy ghi đè file 93MB liên tiếp 10 lần, khiến VPS bị treo cứng và sập do tràn RAM (Out of Memory).
3.  **Thuật toán Sắp xếp (Sorting) dư thừa và lặp lại liên tục**:
    *   Hàm chuyển đổi tóm tắt truyện `toSummary()` được gọi cho mỗi bộ truyện trong danh sách. Bên trong hàm này lại thực hiện nhân bản và sắp xếp lại toàn bộ chương truyện: `const chapters = [...comic.chapters].sort((a, b) => a.number - b.number)`.
    *   Khi tải trang chủ Local, server chạy hàm này trên toàn bộ 4.375 truyện, tức là thực hiện sắp xếp mảng chương hàng nghìn lần trên mỗi request API, gây nghẽn CPU nghiêm trọng.
4.  **Thiếu Phân Trang phía Local (No Pagination)**:
    *   Endpoint `/api/comics` load dữ liệu Local hiện tại không có cơ chế phân trang. Khi tải trang chủ Local, server trả về toàn bộ mảng chứa tóm tắt của 4.300+ bộ truyện làm payload phản hồi JSON lên tới vài Megabytes, làm đơ trình duyệt của client và nghẽn băng thông server.

---

## 4. CÁCH KHẮC PHỤC TRIỆT ĐỂ: CÓ CẦN ĐỔI VPS KHÔNG?

> **Lưu ý quan trọng**: 
> **Không cần thiết phải đổi VPS** (nếu VPS hiện tại là cấu hình 1 Core - 1GB RAM) chỉ vì lượng truy cập nhỏ/cá nhân.
> Nâng cấp VPS chỉ là giải pháp tạm thời ("dùng tiền đè lỗi") và hệ thống sẽ lại tiếp tục bị treo khi dữ liệu truyện tiếp tục tăng lên (ví dụ lên 200MB, 500MB). **Khắc phục triệt để bằng cách tối ưu hóa giải thuật và cơ sở dữ liệu** là bắt buộc.

### Giải pháp 1: Chuyển đổi Cơ sở dữ liệu sang SQLite (Khuyên dùng - Triệt để nhất)
Thay vì dùng file JSON phẳng, hãy dùng **SQLite** (thư viện `better-sqlite3` hoặc `sqlite3` thuần Node.js).
*   **Tại sao nên dùng?** SQLite lưu trữ dữ liệu dưới dạng file đơn, cực kỳ nhẹ, không cần cài đặt dịch vụ database phức tạp trên VPS. 
*   **Ưu điểm**:
    *   Không cần load toàn bộ 93MB dữ liệu vào RAM của Node.js.
    *   Hỗ trợ phân trang trực tiếp ở mức câu lệnh SQL (`LIMIT`, `OFFSET`) cực nhanh mà không tốn tài nguyên.
    *   Truy vấn tìm kiếm, lọc thể loại bằng chỉ mục (Index) mất chưa tới 1 mili giây.
    *   Khi crawler cập nhật 1 chương truyện, chỉ cần chạy câu lệnh `INSERT`/`UPDATE` đúng dòng đó, không ảnh hưởng đến toàn bộ truyện khác, CPU/RAM sẽ luôn ở mức cực kỳ thấp (<5%).

### Giải pháp 2: Chia tách nhỏ File JSON (Nếu muốn giữ nguyên cơ chế File JSON)
Nếu không muốn chuyển sang SQLite, bắt buộc phải tách file `comics.json` 93MB ra thành các file nhỏ:
1.  **File tóm tắt (`data/comics_summary.json`)**: Chỉ chứa danh sách tóm tắt của tất cả truyện (không chứa thông tin mảng `chapters` hay `pages`). Kích thước file này sẽ giảm từ 93MB xuống chỉ còn **~1MB**. Khi load trang chủ hoặc tìm kiếm, server chỉ cần đọc file này, parse siêu nhanh và không tốn CPU/RAM.
2.  **File chi tiết từng truyện (`data/comics/{comic-slug}.json`)**: Mỗi bộ truyện sẽ có một file JSON riêng biệt lưu trữ thông tin chi tiết và toàn bộ danh sách chương cùng các trang ảnh của nó.
    *   Khi người dùng vào trang chi tiết truyện hoặc đọc chương, server chỉ đọc đúng file JSON của truyện đó (dung lượng chỉ vài chục KB).
    *   Khi crawler cập nhật chương mới hoặc live fetch ảnh, server chỉ ghi đè đúng file JSON của bộ truyện tương ứng, giải quyết hoàn toàn việc ghi đè file 93MB trong vòng lặp.

---

## 5. HƯỚNG DẪN TRIỂN KHAI CHI TIẾT (ĐA LẬP KẾ HOẠCH)

AI ở phiên chat tiếp theo nên triển khai các bước tối ưu hóa sau đây (Dưới đây là kế hoạch chi tiết cho việc **tách nhỏ file JSON** hoặc **phân trang**):

### Bước 1: Tối ưu bộ nhớ và chia nhỏ cơ chế lưu trữ ở `server/storage.ts`
*   Định nghĩa hàm `writeComicDirect(comic: Comic)` để lưu file chi tiết truyện độc lập vào thư mục `data/comics/{slug}.json`.
*   Tối ưu hàm `readComics()` và `writeComics()` để chỉ làm việc với danh sách tóm tắt truyện (Summary list) thay vì chứa toàn bộ chapters và pages nặng nề.
*   Tránh deep clone bằng `JSON.parse(JSON.stringify(comic))` trong lưu trữ, thay bằng map/spread để xóa trường `pages` thừa trước khi cache danh sách tóm tắt.

### Bước 2: Thêm phân trang Server-side trong `server/index.ts`
*   Cập nhật endpoint `app.get("/api/comics")` hỗ trợ nhận tham số `page` và `limit` (ví dụ: mặc định 24 truyện/trang).
*   Thực hiện phân trang trước khi gửi về client:
    ```typescript
    const page = Number(request.query.page || 1);
    const limit = Number(request.query.limit || 24);
    const startIndex = (page - 1) * limit;
    const paginatedItems = filtered.slice(startIndex, startIndex + limit);
    response.json({
      items: paginatedItems,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(filtered.length / limit),
        totalItems: filtered.length
      }
    });
    ```
*   Loại bỏ sắp xếp `.sort()` lặp đi lặp lại trong hàm `toSummary` bằng cách đảm bảo mảng chương đã được sort sẵn một lần duy nhất khi load/lưu dữ liệu.

### Bước 3: Cập nhật Crawler ở `server/sync.ts`
*   Thay thế toàn bộ lệnh gọi ghi đè database `await writeComics(comics)` bên trong vòng lặp crawler bằng hàm ghi đĩa đơn lẻ `await writeComicDirect(updatedComic)`.
*   Chỉ cập nhật danh sách tóm tắt truyện khi có chương mới thực sự.

### Bước 4: Cập nhật API Client và UI ở Frontend (`src/api.ts` và `src/App.tsx`)
*   Cập nhật hàm `fetchComics` trong `src/api.ts` để truyền tham số `page` và xử lý định dạng phản hồi phân trang mới.
*   Cập nhật component hiển thị danh sách truyện `CatalogView` trong `src/App.tsx` hỗ trợ phân trang cho nguồn truyện `local` giống hệt như nguồn truyện `otruyen` và hiển thị thanh điều khiển chuyển trang (`PaginationControls`).

---

## 6. THÔNG TIN THAM KHẢO VỀ FILE MÃ NGUỒN CHÍNH
*   [README.md](file:///d:/Web_truyen/README.md) - Hướng dẫn chạy và tổng quan dự án.
*   [package.json](file:///d:/Web_truyen/package.json) - Quản lý thư viện phụ thuộc.
*   [server/storage.ts](file:///d:/Web_truyen/server/storage.ts) - Nơi quản lý lưu trữ (Cần sửa đổi cơ chế đọc/ghi JSON).
*   [server/index.ts](file:///d:/Web_truyen/server/index.ts) - Định nghĩa API routes (Cần tối ưu phân trang và hàm `toSummary`).
*   [server/sync.ts](file:///d:/Web_truyen/server/sync.ts) - Tiến trình crawler chạy ngầm (Cần tối ưu ghi đĩa đơn lẻ).
*   [src/api.ts](file:///d:/Web_truyen/src/api.ts) - Các cuộc gọi API từ client (Cần thêm tham số phân trang).
*   [src/App.tsx](file:///d:/Web_truyen/src/App.tsx) - Toàn bộ giao diện React (Cần hiển thị phân trang local).
