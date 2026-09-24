# 📚 Multi-Source Comic & Media Aggregator (Full-Stack Web Platform)

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.0-646CFF?logo=vite)](https://vitejs.dev/)
[![Express](https://img.shields.io/badge/Express-4.18-000000?logo=express)](https://expressjs.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

An enterprise-grade, high-performance web platform for streaming and reading digital comic books and video media. Built with modern TypeScript frontend architecture, high-efficiency caching proxies, automated content crawlers, and role-based access control (RBAC).

---

## ✨ Key Features & Technical Highlights

### 🎨 Frontend & UI/UX
- **Modular Component Architecture**: Clean separation of concerns with atomic UI components, feature modules, custom hooks, and pages.
- **Dual Reading & Streaming Modes**: Seamless switching between Comic Book Reader mode (OTruyen/TruyenQQ API + Local Storage) and Movie Streaming mode (VSMOV API).
- **Gamification & Engagement**: Integrated User XP, Level Progression, Animated Avatar Frames, Reading Streak, and Sticker Comments.
- **Custom Reader Experience**: Vertical scroll / Paginated page reader with full-screen toggle, zoom controls, and chapter navigation history.

### 🛡️ Backend & High-Performance Proxy Layer
- **Image Proxy & Referer Spoofing Layer**: Solves cross-origin resource sharing (CORS) and anti-hotlinking protections (Referer validation) with express caching middleware.
- **Automated Web Crawler & Metadata Sync**: Background scheduled sync engine with rate-limiting, batch chunk processing, and automated index updates.
- **Role-Based Access Control (RBAC)**: JWT authentication with User and Admin roles for metadata management and content moderation.

---

## 🏗️ Architecture & Folder Structure

```
Web_truyen/
├── server/                     # Backend Express App & Services
│   ├── auth.ts                 # JWT Authentication & RBAC Engine
│   ├── importer.ts             # JSON & External Content Importer
│   ├── index.ts                # Express API Server Entrypoint
│   ├── providers.ts            # Content Provider Aggregators (OTruyen, TruyenQQ, VSMOV)
│   ├── storage.ts              # Local High-Speed Flat-File JSON Storage
│   └── sync.ts                 # Automated Background Crawl & Sync Service
├── src/                        # Frontend React Application
│   ├── components/             # Reusable UI & Feature Components
│   │   ├── comic/              # Comic cards, filters, and reader widgets
│   │   ├── common/             # Base UI elements, frame animations, optimized images
│   │   ├── layout/             # Header, Navigation, and Footer
│   │   ├── modals/             # Auth, User Dashboard, Admin Dashboard
│   │   └── movie/              # Movie catalog & media player components
│   ├── constants/              # System constants and configuration specs
│   ├── hooks/                  # Custom React hooks (debounce, responsive, visible)
│   ├── pages/                  # Page-level containers & views
│   ├── utils/                  # Helper utilities and hash routing
│   ├── App.tsx                 # Modular Root App Component
│   ├── main.tsx                # React DOM Mount Entrypoint
│   └── types.ts                # Strict TypeScript Interfaces & Types
├── data/                       # Storage directory (flat-file JSON database)
├── scripts/                    # CLI Utilities & Maintenance Scripts
└── public/                     # Static Assets, Animations, and Avatar Frames
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js**: v18.0 or higher
- **npm**: v9.0 or higher

### Local Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/web-truyen.git
   cd web-truyen
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the Development Server (Frontend + Backend)**:
   ```bash
   npm run dev
   ```

   - **Frontend UI**: `http://localhost:5173`
   - **Backend API Server**: `http://localhost:3001`

4. **Verify TypeScript & Production Build**:
   ```bash
   npm run check
   ```

---

## 🛰️ Content Crawler & Provider Commands

- **Run TruyenQQ Metadata Crawl (Safe Rate-Limited Mode)**:
  ```bash
  npm run crawl:truyenqq -- 5
  ```

- **Run Fast Sync (Resume from specific page)**:
  ```bash
  npm run crawl:truyenqq:fast -- --from 100
  ```

---

## ⚙️ Environment Variables & VPS Deployment

When deploying to a production VPS, set the following environment variables:

```bash
PORT=3001
ENABLE_TRUYENQQ_AUTO_SYNC=1
TRUYENQQ_INITIAL_SYNC_PAGES=3
TRUYENQQ_INTERVAL_SYNC_PAGES=3
```

Run build script for production deployment:
```bash
npm run build
npm run start
```

---

## 📄 License
This project is licensed under the MIT License.
