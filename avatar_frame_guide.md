# Huong dan lam va can chinh khung avatar

File nay ghi lai cach them/sua khung avatar tinh va dong trong web truyen.

## Vi tri file can biet

- Asset khung dat trong: `public/frames/`
- Danh sach khung mo theo level: `src/App.tsx`, tim `AVATAR_FRAME_REWARDS`
- CSS can chinh khung/avatar: `src/styles.css`, tim:
  - `.reader-avatar-frame`
  - `.avatar-frame-video`
  - `.reader-avatar-frame.frame-image`
  - `.top1-reader-frame`
- Sau khi sua xong chay:

```powershell
npm run build
```

Neu Chrome van hien ban cu thi doi `?v=...` trong `src/App.tsx`, vi du `?v=3` thanh `?v=4`, roi `Ctrl + F5`.

## Them khung tinh PNG

Nen dung PNG co nen trong suot. Dat file vao:

```txt
public/frames/ten-khung.png
```

Them vao `AVATAR_FRAME_REWARDS` trong `src/App.tsx`:

```ts
{
  id: "ten-khung",
  label: "Ten khung",
  unlockLevel: 0,
  image: "/frames/ten-khung.png?v=1",
  cssClass: "frame-image ten-khung-frame"
}
```

Can chinh trong `src/styles.css`:

```css
.reader-avatar-frame.ten-khung-frame::after {
  inset: -2%;
  background-size: contain;
}

.reader-avatar-frame.ten-khung-frame > img,
.reader-level-avatar-ring.ten-khung-frame > img,
.qq-comment-avatar.ten-khung-frame > img,
.nav-avatar-frame.ten-khung-frame > img,
.dropdown-avatar-frame.ten-khung-frame > img {
  width: 82%;
  height: 82%;
}
```

Y nghia:

- `inset` am hon thi khung to ra ngoai.
- `width/height` cua `img` lon hon thi avatar hien to hon.
- Neu khung de len mat avatar qua nhieu, tang `width/height` avatar hoac mo rong lo trong file khung.

## Them khung dong WebM

Nen dung WebM VP9 co alpha. MP4 thuong khong co nen trong suot, nen neu video co nen den thi phai xu ly lai.

Dat file vao:

```txt
public/frames/ten-khung.webm
```

Them vao `AVATAR_FRAME_REWARDS`:

```ts
{
  id: "ten-khung-dong",
  label: "Ten khung dong",
  unlockLevel: 14,
  video: "/frames/ten-khung.webm?v=1",
  cssClass: "frame-video ten-khung-dong-frame"
}
```

Neu khung chi danh cho admin, them `adminOnly: true`:

```ts
{
  id: "admin-gold",
  label: "Admin",
  unlockLevel: 14,
  adminOnly: true,
  video: "/frames/admin_alpha.webm?v=4",
  cssClass: "frame-video admin-avatar-frame"
}
```

Khung `adminOnly` van hien cho nguoi dung xem preview, nhung nut "Dung khung nay" chi bat voi tai khoan admin.

Neu them khung admin moi, nho them id vao `ADMIN_ONLY_AVATAR_FRAMES` trong `server/auth.ts` de khoa ca o phia API, tranh nguoi dung tu goi request de gan khung admin.

Khung admin hien tai dung:

- File goc: `C:\Users\ycao7\Downloads\admin.mp4`
- File web: `public/frames/admin_alpha.webm`
- `center_radius_ratio`: `0.28`
- CSS avatar rieng admin: `width/height: 88%`
- CSS khung admin: `inset: -25%`, `width/height: 150%`
- Matte sach nen den: `flood_threshold = 115`, `soft_low = 75`, `soft_high = 220`, `grow_steps = 6`

CSS mau:

```css
.reader-avatar-frame.ten-khung-dong-frame > img,
.reader-level-avatar-ring.ten-khung-dong-frame > img,
.qq-comment-avatar.ten-khung-dong-frame > img,
.nav-avatar-frame.ten-khung-dong-frame > img,
.dropdown-avatar-frame.ten-khung-dong-frame > img {
  width: 100%;
  height: 100%;
}

.reader-avatar-frame.ten-khung-dong-frame .avatar-frame-video {
  inset: -16%;
  width: 132%;
  height: 132%;
  object-fit: contain;
}
```

Y nghia:

- `img width/height`: kich thuoc avatar trong lo khung.
- `.avatar-frame-video inset/width/height`: kich thuoc toan khung dong.
- Khung dong nam tren avatar vi `.avatar-frame-video` co `z-index: 2`, avatar co `z-index: 1`.

## Xoa nen den cho video khung dong

Neu video la MP4 co nen den, khong nen dung `colorkey` manh tren toan anh vi se xoa mat chi tiet toi cua khung nhu ho, vuong mien, chu.

Cach tot hon: tach frame, chi xoa nen den noi lien voi mep ngoai va lo giua, sau do khoet them lo tron o giua de avatar lo ro hon.

### 1. Neu may chua co ffmpeg

Tam dung package nay:

```powershell
npm install --no-save ffmpeg-static
```

Sau do binary nam o:

```txt
node_modules/ffmpeg-static/ffmpeg.exe
```

### 2. Tach frame tu MP4

Vi du input:

```txt
public/frames/top1_doctruyen.mp4
```

Chay:

```powershell
Remove-Item -Recurse -Force .tmp-frames -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path .tmp-frames\top1-src,.tmp-frames\top1-rgba | Out-Null
.\node_modules\ffmpeg-static\ffmpeg.exe -y -i public\frames\top1_doctruyen.mp4 -an -vf "fps=20,scale=384:384:force_original_aspect_ratio=decrease,pad=384:384:(ow-iw)/2:(oh-ih)/2:color=black" .tmp-frames\top1-src\frame_%04d.png
```

### 3. Tao alpha va khoet lo giua

Chay script Python nay trong PowerShell:

```powershell
@'
from collections import deque
from pathlib import Path
from PIL import Image
import numpy as np

src_dir = Path('.tmp-frames/top1-src')
out_dir = Path('.tmp-frames/top1-rgba')
out_dir.mkdir(parents=True, exist_ok=True)

hard_threshold = 38
halo_threshold = 54
center_radius_ratio = 0.28

count = 0
for path in sorted(src_dir.glob('frame_*.png')):
    im = Image.open(path).convert('RGB')
    arr = np.array(im)
    h, w = arr.shape[:2]
    brightness = arr.max(axis=2)
    dark = brightness <= hard_threshold
    remove = np.zeros((h, w), dtype=bool)
    q = deque()

    def push(y, x):
        if 0 <= y < h and 0 <= x < w and dark[y, x] and not remove[y, x]:
            remove[y, x] = True
            q.append((y, x))

    for x in range(w):
        push(0, x)
        push(h - 1, x)
    for y in range(h):
        push(y, 0)
        push(y, w - 1)

    cy, cx = h // 2, w // 2
    seed_radius = max(8, w // 18)
    for y in range(cy - seed_radius, cy + seed_radius + 1):
        for x in range(cx - seed_radius, cx + seed_radius + 1):
            push(y, x)

    while q:
        y, x = q.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            push(ny, nx)

    neighbor = np.zeros_like(remove)
    neighbor[1:, :] |= remove[:-1, :]
    neighbor[:-1, :] |= remove[1:, :]
    neighbor[:, 1:] |= remove[:, :-1]
    neighbor[:, :-1] |= remove[:, 1:]
    remove |= neighbor & (brightness <= halo_threshold)

    yy, xx = np.ogrid[:h, :w]
    rx = w * center_radius_ratio
    ry = h * center_radius_ratio
    center_hole = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1
    remove |= center_hole

    rgba = np.dstack([arr, np.where(remove, 0, 255).astype(np.uint8)])
    Image.fromarray(rgba, 'RGBA').save(out_dir / path.name)
    count += 1

print(f'processed {count} frames, center_radius={center_radius_ratio}')
'@ | python -
```

Can chinh quan trong:

- `center_radius_ratio`: lo tron giua. Tang len thi avatar hien nhieu hon. Giam xuong thi khung che vao avatar nhieu hon.
  - Dang dung cho Top 1: `0.28`
  - Neu lo nho qua: thu `0.30`
  - Neu an mat chi tiet khung qua nhieu: ve `0.26`
- `hard_threshold`: nguong xoa den nen. Tang qua cao se mat chi tiet toi cua khung.
- `halo_threshold`: xoa vien den mo quanh nen. Tang qua cao cung co the an vao chi tiet.

### 4. Ghep lai WebM alpha

```powershell
.\node_modules\ffmpeg-static\ffmpeg.exe -y -framerate 20 -i .tmp-frames\top1-rgba\frame_%04d.png -c:v libvpx-vp9 -pix_fmt yuva420p -auto-alt-ref 0 -b:v 0 -crf 34 public\frames\top1_doctruyen_alpha.webm
```

Kiem tra file co alpha:

```powershell
.\node_modules\ffmpeg-static\ffmpeg.exe -hide_banner -i public\frames\top1_doctruyen_alpha.webm
```

Can thay dong:

```txt
alpha_mode      : 1
```

### 5. Doi app sang file moi

Trong `src/App.tsx`:

```ts
video: "/frames/top1_doctruyen_alpha.webm?v=4"
```

Moi lan tao lai file cu nen tang `v=...` de tranh cache trinh duyet.

### 6. Dọn file tam

```powershell
Remove-Item -Recurse -Force .tmp-frames
```

## Cach can chinh rieng khung Top 1 hien tai

Khung Top 1 hien tai dang dung:

```txt
public/frames/top1_doctruyen_alpha.webm
```

Trong `src/App.tsx`:

```ts
{ id: "top1-doc-truyen", label: "Top 1 đọc truyện", unlockLevel: 14, video: "/frames/top1_doctruyen_alpha.webm?v=3", cssClass: "frame-video top1-reader-frame" }
```

Trong `src/styles.css`:

```css
.reader-avatar-frame.top1-reader-frame > img {
  width: 100%;
  height: 100%;
}

.reader-avatar-frame.top1-reader-frame .avatar-frame-video {
  inset: -16%;
  width: 132%;
  height: 132%;
}
```

Neu muon avatar hien nhieu hon:

1. Tang `center_radius_ratio` khi tao WebM, vi day moi la lo tron that cua khung.
2. Giu `img width/height` la `100%`.

Neu muon ca khung lon hon:

```css
.reader-avatar-frame.top1-reader-frame .avatar-frame-video {
  inset: -18%;
  width: 136%;
  height: 136%;
}
```

Neu muon ca khung nho hon:

```css
.reader-avatar-frame.top1-reader-frame .avatar-frame-video {
  inset: -12%;
  width: 124%;
  height: 124%;
}
```

## Build va test

Sau moi lan sua:

```powershell
npm run build
```

Mo:

```txt
http://localhost:3001
```

Neu web dang chay san bang `npm start`, refresh manh:

```txt
Ctrl + F5
```

Khi up VPS, nho up ca:

- `src/App.tsx`
- `src/styles.css`
- `public/frames/...`
- `dist/`
- `dist-server/`

Khong up de thu muc `data/` tren VPS neu muon giu tai khoan, comment, lich su doc, data crawl moi nhat.
