# SmartChain: Integrated Supply Chain Intelligence

Platform manajemen rantai pasok terintegrasi untuk **PT Nusantara Manufacturing** (**3 pabrik, 15 pemasok utama + 5 pemasok cadangan Tier-2, 8 gudang, dan 25 distributor**) menggunakan arsitektur **Modular Monolith** TypeScript, autentikasi JWT berbasis **RBAC**, penyimpanan *offline-first* (**IndexedDB**), dan ketahanan terhadap 6 skenario gangguan ekstrem.

---

## 1. Arsitektur & Struktur Proyek

```text
SmartChain/
├── .github/workflows/ci-cd.yml   # Pipeline GitHub Actions (CI Test/Build/DB + CD GHCR)
├── docker-compose.yml            # PostgreSQL 16 service untuk pengembangan lokal
├── database/
│   ├── schema.sql                # Skema PostgreSQL + trigger append-only audit_logs
│   └── csv/                      # Sampel dataset kotor (suppliers, inventory, demand, orders)
├── docs/
│   ├── PRD.md                    # Product Requirements Document
│   ├── AGENTS.md                 # Kontrak teknis & endpoint API
│   ├── DESIGN.md                 # Sistem desain warm-paper tactile & token :root
│   └── openapi.yaml              # Spesifikasi OpenAPI 3.0.3 untuk seluruh REST API
└── apps/
    ├── api/                      # Express.js + TypeScript (strict) + Prisma ORM
    │   ├── prisma/               # schema.prisma & seed.ts (50 akun + dataset kotor)
    │   ├── scripts/              # run-prisma.mjs (loader .env root monorepo)
    │   └── src/
    │       ├── middleware/       # auth.ts (JWT/RBAC), anomalyGuard.ts, errorHandler.ts
    │       ├── modules/          # auth, srm, po, wms, orders, tms, analytics, dashboard, users
    │       └── tests/            # Suite pengujian 6 skenario gangguan & Separation of Duties
    └── web/                      # Next.js 15 (App Router) + React 19 + Tailwind CSS
        └── src/
            ├── app/              # Halaman per peran (/, /srm, /wms, /tms, /analytics, /partner, /admin, /login)
            ├── components/       # UI taktil, grafik SVG interaktif, modal konfirmasi in-page
            ├── hooks/            # Context state + hidrasi API + offline sync
            └── lib/              # apiClient.ts, rbac.ts, offlineQueue.ts (IndexedDB), mockSnapshot.ts
```

---

## 2. Peran RBAC & *Separation of Duties*

Setiap akun diautentikasi dengan **JWT Bearer Token** (`POST /api/auth/login`) dan diarahkan ke ruang kerja khusus sesuai perannya (tanpa satu *Superadmin* operasional tunggal):

| Peran | Rute Utama | Wewenang & Fitur Utama |
| :--- | :--- | :--- |
| **`DIREKSI`** | `/`, `/analytics` | **Hanya-baca:** Control Tower 3 pabrik, Simulator 6 Gangguan, Grafik Hybrid WMA, Safety Stock/ROP, dan Audit Log. |
| **`PROCUREMENT_MANAGER`** | `/srm`, `/analytics` | Kelola 15+5 pemasok, hentikan pemasok (14 hari), picu Auto-RFQ Tier-2, buat & setujui PO berbasis ROP. |
| **`WAREHOUSE_OPERATOR`** | `/wms` | Terminal multi-gudang (`WH-01`–`WH-08`), pemindaian RFID (`IN`/`OUT`/`CYCLE_COUNT`), mode offline 48 jam (IndexedDB), uji replay *idempotency*, & karantina selisih. |
| **`LOGISTICS_MANAGER`** | `/tms`, `/analytics` | Filter *Anomaly Guard* (>150% kuota / kredit), verifikasi deposit atau tolak order, alokasi prioritas SLA (+300% lonjakan), konsolidasi rute TMS, & direktori 25 distributor. |
| **`PARTNER`** | `/partner` | **Portal terisolasi per `entityCode`:** Pemasok (`SUP-01`–`SUP-20`) konfirmasi PO/RFQ & kirim barang; Distributor (`DIST-01`–`DIST-25`) ajukan order dengan meteran kuota & lacak resi. |
| **`SYSTEM_ADMIN`** | `/admin` | **Non-transaksional (IT Security):** Buat akun, ubah peran RBAC, aktif/nonaktifkan akun, reset sandi, & audit akses (diblokir `403` dari transaksi bisnis). |

### Kredensial Uji Coba (`npm run db:seed`)

Kata sandi standar seluruh akun demo: **`smartchain123`**

- **Internal:** `direksi@nusantara-mfg.co.id`, `pengadaan@nusantara-mfg.co.id`, `gudang@nusantara-mfg.co.id`, `logistik@nusantara-mfg.co.id`, `admin@nusantara-mfg.co.id`
- **20 Mitra Pemasok (`SUP-01`–`SUP-20`):** `mitra@bajanusantara.co.id` (`SUP-01`), `sup-02@mitra.nusantara-mfg.co.id` s.d. `sup-20@mitra.nusantara-mfg.co.id` (termasuk `sup-04@...` pemilik `PO-2026-001` & `sup-16@...` penerima RFQ cadangan)
- **25 Mitra Distributor (`DIST-01`–`DIST-25`):** `order@distribusitimur.co.id` (`DIST-01`), `order@sentosajaya.co.id` (`DIST-02`), `dist-03@mitra.nusantara-mfg.co.id` s.d. `dist-25@mitra.nusantara-mfg.co.id`

---

## 3. Dokumentasi API (OpenAPI 3.0.3)

Spesifikasi lengkap seluruh 27 operasi API (25 *path*) tersedia di [docs/openapi.yaml](file:///c:/project/SmartChain/docs/openapi.yaml) dan dapat diakses langsung saat server API berjalan melalui:

- `GET http://localhost:4000/api/openapi.yaml`

Anda dapat mengimpor berkas tersebut ke **Swagger Editor**, **Postman**, atau **Insomnia**. Ringkasan endpoint kunci ketahanan gangguan:

- `POST /api/auth/login` — Autentikasi email & kata sandi (`JWT`)
- `POST /api/srm/rfq-fallback` — RFQ otomatis ke pemasok cadangan Tier-2 & penyesuaian ROP
- `POST /api/wms/sync-batch` — Sinkronisasi batch offline ber-`idempotencyKey` tanpa duplikasi
- `POST /api/wms/reconcile` — Rekonsiliasi *cycle count* & karantina selisih ke *AuditLog*
- `POST /api/orders/validate` — Validasi *Anomaly Guard* sebelum penguncian stok
- `POST /api/orders/allocate-surge` — Alokasi prioritas SLA saat lonjakan +300%
- `POST /api/tms/consolidate` — Penggabungan muatan searah (`routeGroup`) untuk hemat biaya kirim
- `GET /api/analytics/forecast` — *Safety Stock* dinamis, ROP, & *Hybrid WMA* toleran data bolong
- `GET / PATCH / POST /api/admin/users/*` — Manajemen akun & RBAC khusus `SYSTEM_ADMIN`

---

## 4. Cara Menjalankan di Lokal

1. Salin konfigurasi lingkungan:
   ```bash
   cp .env.example .env
   ```
2. Jalankan PostgreSQL 16:
   ```bash
   docker compose up -d
   ```
3. Pasang dependensi, bangun klien Prisma, migrasi skema, dan isi dataset simulasi:
   ```bash
   npm install
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   ```
4. Jalankan pengujian otomatis & kompilasi TypeScript/Next.js:
   ```bash
   npm test
   npm run build
   ```
5. Jalankan server API dan Frontend di dua terminal terpisah:
   ```bash
   npm run dev:api
   npm run dev:web
   ```
   Akses aplikasi web di `http://localhost:3000` dan API di `http://localhost:4000`.

---

## 5. CI/CD (GitHub Actions)

Workflow [.github/workflows/ci-cd.yml](file:///c:/project/SmartChain/.github/workflows/ci-cd.yml) menjalankan:
- **`ci-quality`:** `npm ci`, `db:generate`, `typecheck` (API & Web), pemeriksaan aturan [DESIGN.md](file:///c:/project/SmartChain/docs/DESIGN.md), `npm test`, `npm run build`, dan `npm audit --audit-level=critical`.
- **`db-integration`:** Pengujian skema Prisma & `db:seed` terhadap container `postgres:16-alpine`.
- **`cd-images` & `cd-deploy`:** Build & push image Docker ke `ghcr.io` pada branch `main` (dan pemicu *webhook* deploy jika secret `DEPLOY_WEBHOOK_URL` diisi).

---

## 6. Lisensi

Proyek ini menggunakan lisensi **MIT** — lihat berkas [LICENSE](file:///c:/project/SmartChain/LICENSE).
