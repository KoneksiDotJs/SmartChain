# DESIGN.md — Sistem Desain & Spesifikasi UI/UX SmartChain

Sistem desain ini mengadaptasi estetika **kertas hangat taktil** (*warm-paper tactile*) dari referensi `coral.jpg` serta standar ketahanan tata letak (*The Floor*) dari `hallmark.zip` untuk antarmuka operasional **SmartChain** PT Nusantara Manufacturing.

---

## 1. Token Warna (`:root`)

Seluruh komponen wajib mereferensikan variabel CSS berikut. Penggunaan kode warna literal di luar `:root` tidak diperbolehkan.

| Token | Nilai Hex | Peran Penggunaan |
| :--- | :--- | :--- |
| `--bg` | `#f3f0ea` | Latar belakang utama kanvas halaman (kertas batu hangat) |
| `--bg-subtle` | `#eae6de` | Latar belakang kontrol segmen (*segmented pill*) dan pemisah halus |
| `--surface` | `#ffffff` | Permukaan kartu utama, tabel, dan lembar kerja taktil |
| `--surface-warm` | `#faf9f6` | Header tabel, baris *hover*, dan kartu sekunder |
| `--ink` | `#141413` | Warna teks utama, judul, dan tombol aksi primer |
| `--ink-muted` | `#5c5a54` | Teks sekunder, label kolom, dan keterangan metadata |
| `--border` | `#dfdbd2` | Garis tepi kartu, pembatas tabel, dan kontainer input |
| `--accent` | `#c2410c` | Sinyal peringatan kritis, status anomali, dan tombol aksi korektif |
| `--accent-soft` | `#fff1eb` | Latar belakang *pill badge* status kritis |
| `--ok` | `#15803d` | Status sehat, *online*, dan pesanan lolos SLA |
| `--ok-soft` | `#ecfdf5` | Latar belakang *pill badge* status sehat |
| `--warn` | `#b45309` | Status peringatan (*offline queue*, siaga, lonjakan) |
| `--warn-soft` | `#fef3c7` | Latar belakang *pill badge* peringatan |

---

## 2. Tipografi & Skala Teks

- **Display / Judul:** `'Plus Jakarta Sans', 'Inter', system-ui, sans-serif` (bobot `700–800`, *letter-spacing* `-0.025em`).
- **Teks Isi & Navigasi:** `'Inter', system-ui, sans-serif` (ukuran dasar `15px`, *line-height* `1.55`).
- **Angka, ID, & Timestamp:** `'JetBrains Mono', ui-monospace, monospace` dengan `font-variant-numeric: tabular-nums` dan rata kanan (`text-align: right`) pada kolom tabel numerik.
- **Aturan Label:** Gunakan *sentence case* tanpa `text-transform: uppercase` dan tanpa *letter-spacing* lebar pada label, header tabel, atau *badge*.

---

## 3. Komponen Utama & Pola Interaksi

1. **Topbar Lengket (*Sticky Header*):** Menampilkan *wordmark* **SmartChain** di kiri, tautan navigasi modul berbentuk pil di tengah (`Ringkasan`, `SRM & PO`, `WMS & Offline`, `Order & TMS`), dan satu tombol aksi utama (`bg: var(--ink)`) di kanan.
2. **Kontrol Segmen Pil (*Segmented Control*):** Digunakan untuk beralih antara kondisi **Normal** dan **Simulasi 6 Gangguan**, mengikuti gaya tombol pil taktil pada `coral.jpg`.
3. **Kartu Kertas Taktil (*Tactile Paper Card*):** Sudut membulat `16px`, border `1px solid var(--border)`, dan bayangan lembut `--shadow-paper: 0 12px 32px -12px rgba(20, 20, 19, 0.09)`. Hindari menumpuk kartu di dalam kartu.
4. **Pill Status Badge:** Kapsul membulat penuh (`border-radius: 9999px`) dengan teks `12px` bobot `600` untuk menandai status (*Aktif*, *Offline 48 Jam*, *Selisih 180*, *Anomali*).
5. **Notifikasi In-Page (Toast):** Seluruh umpan balik aksi pengguna wajib menggunakan komponen *toast* atau modal di dalam halaman; dilarang memakai `alert()`, `confirm()`, atau `prompt()`.

---

## 4. Aturan Ketat Implementasi (The Floor)

- **Tata Letak & Responsivitas:** Terapkan `overflow-x: clip` pada `html` dan `body`; batasi lebar kontainer utama pada `1180px` terpusat; gunakan `minmax(0, 1fr)` pada kolom grid.
- **Aksesibilitas & Gerakan:** Setiap tombol dan tautan interaktif wajib memiliki gaya `:focus-visible` yang jelas; sertakan aturan `@media (prefers-reduced-motion: reduce)`; hindari `transition: all`.
- **Kebersihan Visual:** Dilarang menggunakan emoji sebagai pengganti ikon (gunakan ikon SVG garis tipis yang seragam), dilarang menggunakan gradasi ungu-biru, dan dilarang menaruh titik dekoratif atau *middle-dot* berlebih pada metadata.
