# Product Requirements Document (PRD): SmartChain

**Proyek:** SmartChain — Integrated Supply Chain Intelligence  
**Klien / Studi Kasus:** PT Nusantara Manufacturing (3 Pabrik, 15 Pemasok Utama, 8 Gudang, 25 Distributor)  
**Mata Kuliah:** Konsep dan Fondasi Sistem Informasi (Dosen Pengampu: Agus Hermanto)  
**Standar Acuan:** ISO/IEC/IEEE 29148:2018 & ASCM SCOR Digital Standard  

---

## 1. Ringkasan Produk & Tujuan Bisnis

PT Nusantara Manufacturing saat ini mengoperasikan unit pengadaan, pergudangan, produksi, dan distribusi menggunakan aplikasi terpisah (*data silo*). Kondisi ini menyebabkan ketidakstabilan pasokan bahan baku, keterlambatan pengiriman, selisih data persediaan, serta ketiadaan visibilitas posisi barang secara *real-time*.

**SmartChain** dibangun untuk menyatukan seluruh aliran rantai pasok ke dalam satu platform terintegrasi (*end-to-end*) yang mencakup modul **SRM, Procurement/PO, Inventory Management, WMS (Barcode/RFID), TMS, dan Business Analytics**, sekaligus tahan terhadap enam skenario gangguan operasional ekstrem.

---

## 2. Pengguna & Hak Akses (RBAC)

| Peran | Ruang Lingkup Operasional | Hak Akses Utama |
| :--- | :--- | :--- |
| **Direksi** | Pengawasan strategis lintas unit | Akses baca penuh pada *Business Analytics Dashboard*, KPI pemasok/distribusi, dan laporan anomali. |
| **Manajer Pengadaan & Produksi** | 15 pemasok utama + cadangan, 3 pabrik | Kelola SRM, persetujuan PO, pemicu RFQ cadangan, dan kebutuhan bahan baku. |
| **Manajer & Operator Gudang** | 8 gudang & pemindaian Barcode/RFID | Catat mutasi stok (mode *online* dan *offline* 48 jam), *cycle count*, dan karantina selisih. |
| **Manajer Distribusi & Logistik** | 25 distributor & armada pengiriman | Validasi anomali order, alokasi stok berbasis SLA, dan konsolidasi rute TMS. |
| **Mitra Eksternal** | Pemasok & Distributor | Akses portal terbatas untuk konfirmasi PO/RFQ dan pengajuan serta pelacakan order. |

---

## 3. Kebutuhan Fungsional & Kriteria Penerimaan (Acceptance Criteria)

| ID | Modul | Kebutuhan Fungsional | Kriteria Penerimaan (QA) |
| :--- | :--- | :--- | :--- |
| **FR-01** | **SRM & Multi-Sourcing** | Kelola pemasok utama & cadangan beserta skor SLA, serta pemicu RFQ otomatis jika pasokan utama terhenti. | Saat pemasok utama ditandai berhenti (14 hari), sistem otomatis menghasilkan draf RFQ ke pemasok cadangan Tier-2. |
| **FR-02** | **Procurement & PO** | Buat, setujui, dan lacak PO yang terhubung ke ambang batas *Reorder Point* (ROP) bahan baku. | Jika stok tersedia menyentuh/di bawah ROP, sistem menampilkan rekomendasi PO dengan perhitungan kebutuhan bahan baku. |
| **FR-03** | **WMS & RFID Tracking** | Rekam mutasi stok via Barcode/RFID dan sediakan rekonsiliasi *cycle count*. | Jika data RFID (500) berbeda dengan hitung fisik (320), selisih 180 unit otomatis masuk status **Karantina** dan tercatat di *audit log*. |
| **FR-04** | **Offline-First Sync** | Catat transaksi gudang secara lokal saat jaringan terputus hingga 48 jam, lalu sinkronkan saat daring. | Pemindaian saat *offline* tersimpan di antrean lokal; saat koneksi pulih, *batch sync* memproses data berdasar *timestamp* tanpa duplikasi (*idempotency key*). |
| **FR-05** | **Order Anomaly Guard** | Deteksi pesanan fiktif distributor dan terapkan prioritas alokasi berbasis SLA. | Order yang melebihi ambang kuota historis (mis. >150% tanpa konfirmasi) otomatis ditahan (*flag* anomali) sebelum mengunci stok. |
| **FR-06** | **TMS & Distribusi** | Kelola pengiriman ke 25 distributor, lacak status, dan konsolidasikan rute/muatan. | Modul TMS dapat mengelompokkan pengiriman searah untuk menekan lonjakan biaya transportasi (+40%). |
| **FR-07** | **Business Analytics** | Hitung *safety stock*, ROP, evaluasi kinerja, dan *demand forecasting* adaptif. | Saat data historis 3 bulan terakhir tidak lengkap, sistem memakai metode statistik hibrida (*Weighted Moving Average*) dan menampilkan penanda kualitas data. |

---

## 4. Kebutuhan Non-Fungsional

1. **Ketahanan Offline (NFR-01):** Operasional pencatatan gudang wajib tetap berjalan minimal 48 jam tanpa koneksi internet dengan *zero data loss*.
2. **Auditabilitas (NFR-02):** Setiap mutasi stok, sinkronisasi *offline*, dan koreksi *cycle count* wajib tersimpan dalam tabel *immutable audit log*.
3. **Keamanan (NFR-03):** Autentikasi berbasis JWT dan pemisahan otorisasi RBAC ketat antara pengguna internal dan mitra eksternal.
4. **Keterujian (NFR-04):** Seluruh logika bisnis kritis (ROP, *safety stock*, *anomaly guard*, *offline sync*) harus memiliki skenario uji otomatis untuk Minggu ke-3 dan Minggu ke-4.

---

## 5. Matriks Penanganan 6 Skenario Gangguan

| Skenario Gangguan | Mekanisme Sistem di SmartChain |
| :--- | :--- |
| Pemasok utama berhenti 14 hari | *Multi-sourcing* SRM + pemicu RFQ cadangan + penyesuaian ROP berbasis *lead time* baru. |
| Permintaan pasar naik 300% | Penyesuaian *safety stock* dinamis + alokasi prioritas berbasis skor SLA distributor. |
| Koneksi gudang putus 48 jam | Antrean transaksi lokal (*IndexedDB*) + sinkronisasi *batch* berbasis *timestamp* & *idempotency key*. |
| Data RFID 500 vs fisik 320 unit | Alur *cycle-count reconciliation*, karantina 180 unit selisih, dan *audit log* permanen. |
| Pesanan fiktif dari distributor | *Middleware Anomaly Guard* membandingkan order terhadap kuota historis & batas kredit sebelum alokasi. |
| Biaya transport +40% & data 3 bulan bolong | Konsolidasi muatan di TMS + *forecasting* statistik hibrida (*WMA*) dengan indikator kelengkapan data. |
