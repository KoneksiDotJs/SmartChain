# SmartChain: Integrated Supply Chain Intelligence

Platform manajemen rantai pasok terintegrasi untuk **PT Nusantara Manufacturing** (**3 pabrik, 15 pemasok utama + 5 cadangan, 8 gudang, dan 25 distributor**) menggunakan arsitektur **Modular Monolith** TypeScript.

## Arsitektur Modular

- `apps/api`: Express.js + TypeScript (`strict: true`) + Prisma ORM + PostgreSQL
  - `src/modules/auth/`: Autentikasi JWT & 5 peran RBAC (`DIREKSI`, `PROCUREMENT_MANAGER`, `WAREHOUSE_OPERATOR`, `LOGISTICS_MANAGER`, `PARTNER`)
  - `src/modules/srm/`: Multi-sourcing & `POST /api/srm/rfq-fallback`
  - `src/modules/po/`: Pengadaan & PO berbasis *Reorder Point* (ROP)
  - `src/modules/wms/`: Sinkronisasi *offline-first* (`POST /api/wms/sync-batch`) & rekonsiliasi *cycle count* (`POST /api/wms/reconcile`)
  - `src/modules/orders/`: *Anomaly Guard* & alokasi prioritas SLA (`POST /api/orders/validate`)
  - `src/modules/tms/`: Konsolidasi muatan rute (`POST /api/tms/consolidate`)
  - `src/modules/analytics/`: *Safety Stock* dinamis, ROP, & *Hybrid Weighted Moving Average* (`GET /api/analytics/forecast`)
  - `src/modules/dashboard/`: Agregasi KPI lintas unit & *immutable audit log*
- `apps/web`: Next.js (App Router) + React + TypeScript + Tailwind CSS + *IndexedDB Offline Queue*
- `database/`: Skema PostgreSQL (`schema.sql` dengan trigger *append-only* untuk `audit_logs`) & sampel dataset kotor (`csv/`)

## Cara Menjalankan (Lokal)

1. Salin konfigurasi lingkungan:
   ```bash
   cp .env.example .env
   ```
2. Jalankan PostgreSQL:
   ```bash
   docker compose up -d
   ```
3. Pasang dependensi & siapkan basis data:
   ```bash
   npm install
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   ```
4. Jalankan pengujian 6 skenario gangguan:
   ```bash
   npm test
   ```
5. Jalankan API & Frontend:
   ```bash
   npm run dev:api
   npm run dev:web
   ```
