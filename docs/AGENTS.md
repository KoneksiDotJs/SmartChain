# AGENTS.md — Panduan Teknis AI Coding Agent (SmartChain)

Dokumen ini menjadi kontrak teknis wajib bagi AI Coding Agent selama tahap pengembangan (**Minggu 3**) dan pengujian (**Minggu 4**) sistem **SmartChain: Integrated Supply Chain Intelligence** untuk **PT Nusantara Manufacturing**.

---

## 1. Tech Stack & Arsitektur

- **Frontend:** Next.js (App Router) / React, TypeScript, Tailwind CSS.
- **Backend API:** Express.js + TypeScript (arsitektur *Modular Monolith*).
- **Database & ORM:** PostgreSQL + Prisma ORM.
- **Autentikasi:** JWT + *Role-Based Access Control* (RBAC).
- **Offline Edge Storage:** IndexedDB pada klien gudang (WMS PWA) dengan antrean sinkronisasi lokal.

---

## 2. Struktur Direktori Target

```text
smartchain/
├── apps/
│   ├── web/                  # Next.js Frontend (Dashboard, SRM, WMS, TMS)
│   │   ├── src/app/          # Halaman & routing per modul
│   │   ├── src/components/   # Komponen UI mengikuti DESIGN.md
│   │   └── src/lib/          # API client & IndexedDB offline queue
│   └── api/                  # Express + TypeScript Backend
│       ├── prisma/           # schema.prisma, migrations, & seed.ts
│       └── src/
│           ├── modules/      # srm/, po/, wms/, orders/, tms/, analytics/
│           ├── middleware/   # auth.ts (JWT/RBAC), anomalyGuard.ts, errorHandler.ts
│           └── tests/        # Unit & stress-scenario test suite
└── docs/                     # PRD.md, AGENTS.md, DESIGN.md
```

---

## 3. Aturan Skema Database & Integritas Data (Prisma / PostgreSQL)

1. **Entitas Inti Wajib:** `Supplier`, `PurchaseOrder`, `MaterialProduct`, `Warehouse`, `InventoryStock`, `RfidSyncLog`, `Distributor`, `SalesOrder`, `Shipment`, dan `AuditLog`.
2. **Idempotency Sinkronisasi Offline:** Tabel `RfidSyncLog` wajib memiliki kolom `idempotencyKey` bertipe `UNIQUE` dan `offlineTimestamp`. Endpoint sinkronisasi tidak boleh menduplikasi mutasi stok jika *batch* yang sama dikirim ulang.
3. **Immutable Audit Log:** Jangan pernah melakukan `DELETE` atau `UPDATE` pada baris `AuditLog`. Setiap perubahan stok, karantina selisih (mis. 500 vs 320 unit), dan penahanan pesanan fiktif wajib menyisipkan baris audit baru.
4. **Seed Dataset Kotor (Wajib untuk Simulasi):** File `prisma/seed.ts` (dan ekspor SQL/CSV) harus memuat 3 pabrik, 15 pemasok utama + cadangan, 8 gudang, 25 distributor, serta anomali kasus: selisih RFID 500 vs fisik 320 unit, data historis 3 bulan yang tidak lengkap (*null/missing intervals*), dan sampel pesanan fiktif.

---

## 4. Kontrak API Utama

| Endpoint | Method | Tanggung Jawab |
| :--- | :--- | :--- |
| `/api/srm/rfq-fallback` | `POST` | Memicu RFQ otomatis ke pemasok cadangan saat pemasok utama berhenti (14 hari). |
| `/api/wms/sync-batch` | `POST` | Menerima array transaksi *offline* dari gudang, memvalidasi `idempotencyKey`, dan memperbarui `InventoryStock`. |
| `/api/wms/reconcile` | `POST` | Membandingkan `rfidQty` vs `physicalQty`, memindahkan selisih ke `quarantineQty`, dan mencatat `AuditLog`. |
| `/api/orders/validate` | `POST` | Menjalankan *Anomaly Guard* terhadap kuota historis distributor sebelum mengunci alokasi SLA. |
| `/api/tms/consolidate` | `POST` | Mengelompokkan pengiriman searah (`routeGroup`) untuk menekan kenaikan biaya transport (+40%). |
| `/api/analytics/forecast` | `GET` | Mengembalikan perhitungan *Safety Stock*, ROP, dan prediksi permintaan berbasis *Weighted Moving Average* (WMA) hibrida + skor kelengkapan data. |

---

## 5. Aturan Pengembangan & QA untuk AI Agent

1. **Kepatuhan Desain:** Seluruh komponen UI wajib memakai token CSS dari `DESIGN.md`. Dilarang menulis warna literal (*hex*) di luar blok `:root` atau menggunakan `alert()`/`confirm()`/`prompt()`.
2. **Penanganan Error & Tipe:** Gunakan TypeScript `strict: true`. Setiap endpoint Express wajib memvalidasi payload input dan mengembalikan respons JSON terstruktur (`{ success, data, error }`).
3. **Pengujian 6 Skenario Gangguan:** Sebelum menandai modul selesai, agent wajib menulis dan menjalankan skrip pengujian yang membuktikan:
   - Pemasok utama berhenti 14 hari -> RFQ cadangan terpicu.
   - Permintaan naik 300% -> Alokasi mengikuti prioritas SLA.
   - Gudang *offline* 48 jam -> *Batch sync* pulih tanpa duplikasi.
   - RFID 500 vs fisik 320 -> 180 unit masuk karantina + *audit log*.
   - Order fiktif -> Ditahan oleh *Anomaly Guard*.
   - Data 3 bulan tidak lengkap -> Model WMA hibrida berjalan dengan indikator peringatan kualitas data.
