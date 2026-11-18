# AGENTS.md — Panduan Teknis AI Coding Agent (SmartChain)

Dokumen ini menjadi kontrak teknis wajib bagi AI Coding Agent selama tahap pengembangan (**Minggu 3**) dan pengujian (**Minggu 4**) sistem **SmartChain: Integrated Supply Chain Intelligence** untuk **PT Nusantara Manufacturing**.

---

## 1. Tech Stack & Arsitektur (Modular Monolith Terpadu)

Sistem menerapkan arsitektur **Modular Monolith**: seluruh sistem manajemen (**SRM, Procurement/PO, Inventory Management, WMS Barcode/RFID, Order & TMS, Business Analytics, serta User/RBAC Admin**) dipisahkan per modul domain yang jelas dan saling terhubung dalam satu platform terpusat dan satu basis data relasional (bukan aplikasi *silo* terpisah).

- **Frontend:** Next.js 15 (App Router) / React 19, TypeScript, Tailwind CSS.
- **Backend API:** Express.js + TypeScript (`strict: true`, arsitektur *Modular Monolith*).
- **Database & ORM:** PostgreSQL 16 + Prisma ORM.
- **Autentikasi & Otorisasi:** JWT Bearer + *Role-Based Access Control* (RBAC) + *Separation of Duties* (peran `DIREKSI` bersifat hanya-baca dan `SYSTEM_ADMIN` non-transaksional) serta halaman login khusus per peran (`/login/direksi`, `/login/pengadaan`, `/login/gudang`, `/login/logistik`, `/login/mitra`, `/login/admin`) yang memvalidasi `expectedRole`.
- **Offline Edge Storage & Scanner:** IndexedDB pada klien gudang (WMS PWA) dengan parser tag **Barcode** (`BC-`, EAN-13 `899100...`) & **RFID** (`RFID:`, `EPC-`), dukungan *keyboard-wedge* USB/Bluetooth, serta `@zxing/browser` untuk kamera webcam laptop/HP dan unggah gambar barcode lintas browser.

---

## 2. Struktur Direktori Target

```text
smartchain/
├── .github/workflows/ci-cd.yml  # Pipeline CI/CD GitHub Actions
├── apps/
│   ├── web/                     # Next.js Frontend
│   │   ├── src/app/             # Halaman terpisah per domain: /, /srm, /po, /inventory, /wms, /tms, /analytics, /partner, /admin, /login
│   │   ├── src/components/      # Komponen UI (DESIGN.md), charts/, auth/, wms/BarcodeRfidScanner.tsx
│   │   ├── src/hooks/           # Context state, hidrasi API, & offline sync
│   │   └── src/lib/             # apiClient, rbac, offlineQueue (IndexedDB), barcodeRfid parser
│   └── api/                     # Express + TypeScript Backend
│       ├── prisma/              # schema.prisma, migrations, & seed.ts (50 akun + dataset kotor)
│       ├── scripts/             # run-prisma.mjs (.env root loader)
│       └── src/
│           ├── modules/         # auth/, srm/, po/, inventory/, wms/, orders/, tms/, analytics/, dashboard/, users/
│           ├── middleware/      # auth.ts (JWT/RBAC), anomalyGuard.ts, errorHandler.ts
│           └── tests/           # Unit & stress-scenario test suite
├── database/                    # schema.sql (append-only trigger) & csv/ sample datasets
└── docs/                        # PRD.md, AGENTS.md, DESIGN.md, openapi.yaml
```

---

## 3. Aturan Skema Database & Integritas Data (Prisma / PostgreSQL)

1. **Entitas Inti Wajib:** `UserAccount` (`isActive`, 6 peran `UserRole`), `Factory`, `Supplier`, `PurchaseOrder`, `MaterialProduct`, `Warehouse`, `InventoryStock`, `RfidSyncLog`, `Distributor`, `SalesOrder`, `Shipment`, `DemandHistory`, dan `AuditLog`.
2. **Idempotency Sinkronisasi Offline & Scanner:** Tabel `RfidSyncLog` wajib memiliki kolom `idempotencyKey` bertipe `UNIQUE` dan `offlineTimestamp`. Baik *batch sync* maupun *scan tag* tidak boleh menduplikasi mutasi stok jika kunci yang sama dikirim ulang.
3. **Immutable Audit Log:** Jangan pernah melakukan `DELETE` atau `UPDATE` pada baris `AuditLog`. Setiap perubahan stok, pemindaian Barcode/RFID, karantina selisih, penahanan pesanan fiktif, dan perubahan akun `SYSTEM_ADMIN` wajib menyisipkan baris audit baru.
4. **Seed Dataset Kotor (Wajib untuk Simulasi):** File `prisma/seed.ts` (dan ekspor SQL/CSV) harus memuat 50 akun (5 internal + 20 pemasok + 25 distributor), 3 pabrik, 15 pemasok utama + 5 cadangan, 8 gudang, 25 distributor, serta anomali kasus: `SUP-01` berhenti 14 hari, selisih RFID 500 vs fisik 320 unit, data historis 3 bulan yang tidak lengkap (*null/missing intervals*), dan sampel pesanan fiktif `ORD-882`.

---

## 4. Kontrak API Utama

| Endpoint | Method | Tanggung Jawab & Otorisasi |
| :--- | :--- | :--- |
| `/api/auth/login` | `POST` | Login email + kata sandi dan penerbitan token JWT. |
| `/api/srm/rfq-fallback` | `POST` | Memicu RFQ otomatis ke pemasok cadangan (`PROCUREMENT_MANAGER`). |
| `/api/po` | `GET / POST` | Pengadaan dan persetujuan PO berbasis ROP (`PROCUREMENT_MANAGER` / `PARTNER`). |
| `/api/inventory/ledger` | `GET` | Buku besar stok lintas 8 gudang & status kesehatan ROP/selisih. |
| `/api/inventory/traceability` | `GET` | Pelacakan hubungan entitas Pemasok → Pabrik → Gudang → Distributor. |
| `/api/wms/scan-tag` | `POST` | Dekode tag Barcode/RFID (`RFID:`, `EPC-`, `BC-`, EAN) & mutasi stok idempoten (`WAREHOUSE_OPERATOR`). |
| `/api/wms/labels` | `POST` | Terbitkan label Code128 / RFID SmartTag / EPC & catat `AuditLog` (`WAREHOUSE_OPERATOR`). |
| `/api/wms/sync-batch` | `POST` | Sinkronisasi batch *offline* ber-`idempotencyKey` (`WAREHOUSE_OPERATOR`). |
| `/api/wms/reconcile` | `POST` | Rekonsiliasi *cycle count*, karantina selisih, & *audit log* (`WAREHOUSE_OPERATOR`). |
| `/api/orders/validate` | `POST` | *Anomaly Guard* (>150% kuota / batas kredit) sebelum alokasi SLA (`LOGISTICS_MANAGER` / `PARTNER`). |
| `/api/orders/allocate-surge` | `POST` | Alokasi prioritas SLA saat lonjakan permintaan +300% (`LOGISTICS_MANAGER`). |
| `/api/tms/consolidate` | `POST` | Konsolidasi pengiriman searah (`routeGroup`) untuk menekan biaya +40% (`LOGISTICS_MANAGER`). |
| `/api/analytics/forecast` | `GET` | *Safety Stock*, ROP, & prediksi *Hybrid WMA* + skor kelengkapan data. |
| `/api/analytics/performance` | `GET` | Evaluasi kinerja pemasok (Grade A/B/C) & koridor distribusi. |
| `/api/admin/users/*` | `GET/POST/PATCH` | Manajemen akun & RBAC khusus `SYSTEM_ADMIN` (*Separation of Duties*). |

Spesifikasi lengkap tercantum pada [openapi.yaml](file:///c:/project/SmartChain/docs/openapi.yaml).

---

## 5. Aturan Pengembangan & QA untuk AI Agent

1. **Kepatuhan Desain:** Seluruh komponen UI dan grafik SVG wajib memakai token CSS dari `DESIGN.md`. Dilarang menulis warna literal (*hex*) di luar blok `:root` atau menggunakan `alert()`/`confirm()`/`prompt()` (wajib memakai `ToastRegion` atau `ConfirmModal`).
2. **Penanganan Error & Tipe:** Gunakan TypeScript `strict: true`. Setiap endpoint Express wajib memvalidasi payload input dengan Zod dan mengembalikan respons JSON terstruktur (`{ success, data, error }`).
3. **Pengujian Otomatis:** Sebelum menandai perubahan selesai, perbarui dan verifikasi suite pengujian (`src/tests/disruptions.test.ts`) yang membuktikan ke-6 skenario gangguan, RBAC + *Separation of Duties*, dekode Barcode/RFID, pelacakan hubungan entitas, serta evaluasi kinerja pemasok & distribusi.
