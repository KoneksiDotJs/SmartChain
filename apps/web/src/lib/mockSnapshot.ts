import type {
  AuditEntryDto,
  ForecastMaterialDto,
  PurchaseOrderDto,
  SalesOrderDto,
  ShipmentDto,
  SupplierDto,
  WarehouseStockDto,
} from './types';

export interface DisruptionScenario {
  id: 'supply' | 'demand' | 'offline' | 'rfid' | 'fake' | 'ai';
  title: string;
  domain: string;
  badge: string;
  badgeVariant: 'alert' | 'warn' | 'ok';
  cause: string;
  action: string;
  metricLabel: string;
  metricVal: string;
  ctaLabel: string;
  targetPath: string;
}

export const DISRUPTION_SCENARIOS: DisruptionScenario[] = [
  {
    id: 'supply',
    title: '1. Pemasok utama berhenti 14 hari',
    domain: 'SRM & Procurement',
    badge: 'Kritis',
    badgeVariant: 'alert',
    cause: 'Ketergantungan pemasok tunggal memicu ancaman produksi berhenti di 3 pabrik.',
    action:
      'Sistem memicu RFQ otomatis ke pemasok cadangan Tier-2 dan menghitung ulang Reorder Point berbasis lead time baru.',
    metricLabel: 'Target Pemulihan Pasokan',
    metricVal: 'RFQ < 2 jam',
    ctaLabel: 'Buka Modul SRM & Picu RFQ',
    targetPath: '/srm',
  },
  {
    id: 'demand',
    title: '2. Permintaan pasar naik 300%',
    domain: 'Inventory & Alokasi',
    badge: 'Lonjakan',
    badgeVariant: 'warn',
    cause: 'Batas safety stock statis tidak sanggup menahan lonjakan pesanan mendadak.',
    action:
      'SmartChain menaikkan safety stock dinamis dan mengunci alokasi berdasarkan skor SLA 25 distributor.',
    metricLabel: 'Aturan Prioritas',
    metricVal: 'SLA Tier-1',
    ctaLabel: 'Lihat Antrean Order',
    targetPath: '/tms',
  },
  {
    id: 'offline',
    title: '3. Koneksi gudang terputus 48 jam',
    domain: 'WMS Edge Client',
    badge: 'Offline-First',
    badgeVariant: 'warn',
    cause: 'Gangguan jaringan di salah satu gudang menghentikan pencatatan keluar-masuk barang.',
    action:
      'Transaksi RFID disimpan di IndexedDB lokal lengkap dengan timestamp, lalu disinkronkan otomatis tanpa duplikasi saat daring.',
    metricLabel: 'Kapasitas Antrean Lokal',
    metricVal: '48+ jam',
    ctaLabel: 'Simulasikan di WMS',
    targetPath: '/wms',
  },
  {
    id: 'rfid',
    title: '4. Data RFID 500 vs fisik 320 unit',
    domain: 'Audit & Rekonsiliasi',
    badge: 'Selisih 180',
    badgeVariant: 'alert',
    cause: 'Phantom inventory membuat sistem menjanjikan stok yang sebenarnya tidak ada di rak.',
    action:
      'Alur cycle count mengkarantina 180 unit selisih dan menulis audit log permanen sebelum stok boleh dialokasikan.',
    metricLabel: 'Selisih Terdeteksi',
    metricVal: '180 unit',
    ctaLabel: 'Jalankan Rekonsiliasi',
    targetPath: '/wms',
  },
  {
    id: 'fake',
    title: '5. Pesanan fiktif dari distributor',
    domain: 'Order Anomaly Guard',
    badge: 'Anomali',
    badgeVariant: 'alert',
    cause: 'Oknum distributor menggandakan order agar mendapat prioritas alokasi barang.',
    action:
      'Middleware Anomaly Guard menahan order yang melampaui 150% kuota historis tanpa konfirmasi deposit.',
    metricLabel: 'Ambang Batas Anomali',
    metricVal: '>150% kuota',
    ctaLabel: 'Periksa Filter Order',
    targetPath: '/tms',
  },
  {
    id: 'ai',
    title: '6. Biaya transport +40% & data 3 bulan bolong',
    domain: 'TMS & Hybrid Analytics',
    badge: 'Hibrida',
    badgeVariant: 'ok',
    cause:
      'Data historis tidak lengkap membuat model AI kompleks berisiko bias, sementara tarif kirim naik 40%.',
    action:
      'TMS menggabungkan muatan antar-rute untuk menekan biaya, dan analitik memakai weighted moving average adaptif.',
    metricLabel: 'Metode Prediksi Aktif',
    metricVal: 'WMA Hibrida',
    ctaLabel: 'Lihat Konsolidasi & Analitik',
    targetPath: '/analytics',
  },
];

export const INITIAL_SUPPLIERS: SupplierDto[] = [
  { id: 'sup-1', code: 'SUP-01', name: 'PT Baja Nusantara', tierType: 'MAIN', slaScore: 96, leadTimeDays: 4, status: 'ACTIVE', haltedDays: 0, materialCategory: 'LOGAM', city: 'Cilegon' },
  { id: 'sup-2', code: 'SUP-02', name: 'PT Krakatau Logam Abadi', tierType: 'MAIN', slaScore: 95, leadTimeDays: 4, status: 'ACTIVE', haltedDays: 0, materialCategory: 'LOGAM', city: 'Serang' },
  { id: 'sup-3', code: 'SUP-03', name: 'CV Polimer Sejahtera', tierType: 'MAIN', slaScore: 93, leadTimeDays: 3, status: 'ACTIVE', haltedDays: 0, materialCategory: 'POLIMER', city: 'Tangerang' },
  { id: 'sup-4', code: 'SUP-04', name: 'CV Logam Makmur', tierType: 'MAIN', slaScore: 94, leadTimeDays: 3, status: 'ACTIVE', haltedDays: 0, materialCategory: 'LOGAM', city: 'Surabaya' },
  { id: 'sup-6', code: 'SUP-06', name: 'PT Presisi Teknik Utama', tierType: 'MAIN', slaScore: 95, leadTimeDays: 4, status: 'ACTIVE', haltedDays: 0, materialCategory: 'KOMPONEN', city: 'Bandung' },
  { id: 'sup-8', code: 'SUP-08', name: 'PT Karton Kemas Prima', tierType: 'MAIN', slaScore: 94, leadTimeDays: 2, status: 'ACTIVE', haltedDays: 0, materialCategory: 'KEMASAN', city: 'Karawang' },
  { id: 'sup-16', code: 'SUP-16', name: 'PT Mitra Bahan Cadangan', tierType: 'BACKUP', slaScore: 91, leadTimeDays: 5, status: 'STANDBY', haltedDays: 0, materialCategory: 'LOGAM', city: 'Bekasi' },
  { id: 'sup-17', code: 'SUP-17', name: 'PT Cadangan Polimer Prima', tierType: 'BACKUP', slaScore: 90, leadTimeDays: 4, status: 'STANDBY', haltedDays: 0, materialCategory: 'POLIMER', city: 'Depok' },
  { id: 'sup-18', code: 'SUP-18', name: 'CV Komponen Siaga', tierType: 'BACKUP', slaScore: 88, leadTimeDays: 5, status: 'STANDBY', haltedDays: 0, materialCategory: 'KOMPONEN', city: 'Klaten' },
];

export const INITIAL_PURCHASE_ORDERS: PurchaseOrderDto[] = [
  {
    id: 'po-1',
    poNumber: 'PO-2026-001',
    supplierCode: 'SUP-04',
    supplierName: 'CV Logam Makmur',
    materialSku: 'MAT-01',
    materialName: 'Baja Lembaran Canai Dingin',
    factoryName: 'Pabrik Cikarang (Utama)',
    quantity: 450,
    isRfqFallback: false,
    triggeredByRop: true,
    status: 'APPROVED',
    expectedDate: '2026-11-19T09:00:00.000Z',
    notes: 'Pengadaan reguler berbasis ambang batas ROP',
  },
];

export const INITIAL_WAREHOUSE_STOCKS: WarehouseStockDto[] = [
  { stockId: 'stk-wh01', warehouseId: 'wh-01', warehouseCode: 'WH-01', warehouseName: 'Gudang #01 (Cikarang Pusat)', city: 'Bekasi', networkStatus: 'ONLINE', offlineHours: 0, lastSyncAt: '2026-11-16T07:58:00.000Z', materialId: 'mat-1', materialSku: 'MAT-01', materialName: 'Baja Lembaran Canai Dingin', rfidQty: 280, physicalQty: 280, quarantineQty: 0, rop: 40, safetyStock: 10 },
  { stockId: 'stk-wh02', warehouseId: 'wh-02', warehouseCode: 'WH-02', warehouseName: 'Gudang #02 (Bandung Barat)', city: 'Bandung', networkStatus: 'ONLINE', offlineHours: 0, lastSyncAt: '2026-11-16T07:59:00.000Z', materialId: 'mat-1', materialSku: 'MAT-01', materialName: 'Baja Lembaran Canai Dingin', rfidQty: 305, physicalQty: 305, quarantineQty: 0, rop: 40, safetyStock: 10 },
  { stockId: 'stk-wh03', warehouseId: 'wh-03', warehouseCode: 'WH-03', warehouseName: 'Gudang #03 (Semarang Pelabuhan)', city: 'Semarang', networkStatus: 'ONLINE', offlineHours: 0, lastSyncAt: '2026-11-16T08:00:00.000Z', materialId: 'mat-1', materialSku: 'MAT-01', materialName: 'Baja Lembaran Canai Dingin', rfidQty: 330, physicalQty: 330, quarantineQty: 0, rop: 40, safetyStock: 10 },
  { stockId: 'stk-wh04', warehouseId: 'wh-04', warehouseCode: 'WH-04', warehouseName: 'Gudang #04 (Surabaya)', city: 'Surabaya', networkStatus: 'ONLINE', offlineHours: 0, lastSyncAt: '2026-11-16T08:00:00.000Z', materialId: 'mat-1', materialSku: 'MAT-01', materialName: 'Baja Lembaran Canai Dingin', rfidQty: 500, physicalQty: 320, quarantineQty: 0, rop: 45, safetyStock: 12 },
  { stockId: 'stk-wh05', warehouseId: 'wh-05', warehouseCode: 'WH-05', warehouseName: 'Gudang #05 (Gresik Industri)', city: 'Gresik', networkStatus: 'ONLINE', offlineHours: 0, lastSyncAt: '2026-11-16T07:57:00.000Z', materialId: 'mat-1', materialSku: 'MAT-01', materialName: 'Baja Lembaran Canai Dingin', rfidQty: 380, physicalQty: 380, quarantineQty: 0, rop: 40, safetyStock: 10 },
  { stockId: 'stk-wh06', warehouseId: 'wh-06', warehouseCode: 'WH-06', warehouseName: 'Gudang #06 (Solo Distribusi)', city: 'Surakarta', networkStatus: 'ONLINE', offlineHours: 0, lastSyncAt: '2026-11-16T07:55:00.000Z', materialId: 'mat-1', materialSku: 'MAT-01', materialName: 'Baja Lembaran Canai Dingin', rfidQty: 405, physicalQty: 405, quarantineQty: 0, rop: 40, safetyStock: 10 },
  { stockId: 'stk-wh07', warehouseId: 'wh-07', warehouseCode: 'WH-07', warehouseName: 'Gudang #07 (Cilegon Bahan Baku)', city: 'Cilegon', networkStatus: 'ONLINE', offlineHours: 0, lastSyncAt: '2026-11-16T07:59:00.000Z', materialId: 'mat-1', materialSku: 'MAT-01', materialName: 'Baja Lembaran Canai Dingin', rfidQty: 430, physicalQty: 430, quarantineQty: 0, rop: 40, safetyStock: 10 },
  { stockId: 'stk-wh08', warehouseId: 'wh-08', warehouseCode: 'WH-08', warehouseName: 'Gudang #08 (Sidoarjo Transit)', city: 'Sidoarjo', networkStatus: 'ONLINE', offlineHours: 0, lastSyncAt: '2026-11-16T07:56:00.000Z', materialId: 'mat-1', materialSku: 'MAT-01', materialName: 'Baja Lembaran Canai Dingin', rfidQty: 455, physicalQty: 455, quarantineQty: 0, rop: 40, safetyStock: 10 },
];

export const INITIAL_SALES_ORDERS: SalesOrderDto[] = [
  { id: 'ord-1', orderNumber: 'ORD-881', distributorCode: 'DIST-01', distributorName: 'PT Distribusi Timur', routeGroup: 'JAWA_BARAT', slaTier: 'TIER_1', slaScore: 96, monthlyQuota: 130, requestedQty: 120, allocatedQty: 120, totalAmount: 50_400_000, anomalyFlag: false, anomalyReason: null, allocationStatus: 'APPROVED_SLA', depositConfirmed: true },
  { id: 'ord-2', orderNumber: 'ORD-882', distributorCode: 'DIST-02', distributorName: 'CV Sentosa Jaya', routeGroup: 'JAWA_BARAT', slaTier: 'TIER_2', slaScore: 86, monthlyQuota: 150, requestedQty: 480, allocatedQty: 0, totalAmount: 201_600_000, anomalyFlag: false, anomalyReason: null, allocationStatus: 'PENDING', depositConfirmed: false },
  { id: 'ord-3', orderNumber: 'ORD-883', distributorCode: 'DIST-03', distributorName: 'PT Surya Mandiri', routeGroup: 'JAWA_TIMUR', slaTier: 'TIER_1', slaScore: 94, monthlyQuota: 110, requestedQty: 95, allocatedQty: 95, totalAmount: 39_900_000, anomalyFlag: false, anomalyReason: null, allocationStatus: 'APPROVED_SLA', depositConfirmed: true },
  { id: 'ord-4', orderNumber: 'ORD-884', distributorCode: 'DIST-05', distributorName: 'PT Mitra Niaga Jakarta 5', routeGroup: 'JAWA_BARAT', slaTier: 'TIER_1', slaScore: 94, monthlyQuota: 110, requestedQty: 105, allocatedQty: 105, totalAmount: 28_875_000, anomalyFlag: false, anomalyReason: null, allocationStatus: 'APPROVED_SLA', depositConfirmed: true },
  { id: 'ord-5', orderNumber: 'ORD-885', distributorCode: 'DIST-07', distributorName: 'PT Mitra Niaga Malang 7', routeGroup: 'JAWA_TIMUR', slaTier: 'TIER_2', slaScore: 87, monthlyQuota: 130, requestedQty: 110, allocatedQty: 110, totalAmount: 14_850_000, anomalyFlag: false, anomalyReason: null, allocationStatus: 'APPROVED_SLA', depositConfirmed: true },
];

export const INITIAL_SHIPMENTS: ShipmentDto[] = [
  { id: 'shp-1', shipmentNumber: 'SHP-2026-01', orderNumber: 'ORD-881', distributorName: 'PT Distribusi Timur', routeGroup: 'JAWA_BARAT', carrierName: 'Ekspedisi Nusantara Darat', baseCost: 5_800_000, consolidatedCost: 5_800_000, isConsolidated: false, consolidationBatchId: null, trackingStatus: 'PLANNED' },
  { id: 'shp-2', shipmentNumber: 'SHP-2026-02', orderNumber: 'ORD-884', distributorName: 'PT Mitra Niaga Jakarta 5', routeGroup: 'JAWA_BARAT', carrierName: 'Ekspedisi Nusantara Darat', baseCost: 5_400_000, consolidatedCost: 5_400_000, isConsolidated: false, consolidationBatchId: null, trackingStatus: 'PLANNED' },
  { id: 'shp-3', shipmentNumber: 'SHP-2026-03', orderNumber: 'ORD-883', distributorName: 'PT Surya Mandiri', routeGroup: 'JAWA_TIMUR', carrierName: 'Logistik Timur Trans', baseCost: 4_900_000, consolidatedCost: 4_900_000, isConsolidated: false, consolidationBatchId: null, trackingStatus: 'PLANNED' },
  { id: 'shp-4', shipmentNumber: 'SHP-2026-04', orderNumber: 'ORD-885', distributorName: 'PT Mitra Niaga Malang 7', routeGroup: 'JAWA_TIMUR', carrierName: 'Logistik Timur Trans', baseCost: 5_100_000, consolidatedCost: 5_100_000, isConsolidated: false, consolidationBatchId: null, trackingStatus: 'PLANNED' },
];

export const INITIAL_FORECAST_MATERIALS: ForecastMaterialDto[] = [
  {
    materialId: 'mat-1',
    sku: 'MAT-01',
    name: 'Baja Lembaran Canai Dingin',
    unit: 'unit',
    currentStock: 2905,
    quarantineStock: 0,
    leadTimeDays: 4,
    dynamicSafetyStock: 47,
    reorderPoint: 307,
    needsProcurement: false,
    recommendedOrderQty: 0,
    forecast: {
      forecastNextPeriod: 516,
      completenessPercent: 66.7,
      validIntervals: 8,
      totalIntervals: 12,
      missingPeriods: ['M1-W3', 'M2-W2', 'M3-W1', 'M3-W4'],
      qualityIndicator: 'INCOMPLETE_DATA_WARNING',
      methodUsed: 'HYBRID_WMA',
      advisoryNote: 'Kelengkapan data 66.7% (4 interval hilang). Menggunakan Weighted Moving Average (WMA) hibrida untuk mencegah bias model AI kompleks.',
    },
  },
  {
    materialId: 'mat-2',
    sku: 'MAT-02',
    name: 'Resin Polimer Industri Grade-A',
    unit: 'unit',
    currentStock: 285,
    quarantineStock: 0,
    leadTimeDays: 3,
    dynamicSafetyStock: 52,
    reorderPoint: 292,
    needsProcurement: true,
    recommendedOrderQty: 59,
    forecast: {
      forecastNextPeriod: 645,
      completenessPercent: 66.7,
      validIntervals: 8,
      totalIntervals: 12,
      missingPeriods: ['M1-W3', 'M2-W2', 'M3-W1', 'M3-W4'],
      qualityIndicator: 'INCOMPLETE_DATA_WARNING',
      methodUsed: 'HYBRID_WMA',
      advisoryNote: 'Kelengkapan data 66.7% (4 interval hilang). Menggunakan Weighted Moving Average (WMA) hibrida untuk mencegah bias model AI kompleks.',
    },
  },
  {
    materialId: 'mat-3',
    sku: 'MAT-03',
    name: 'Komponen Pengikat Presisi',
    unit: 'unit',
    currentStock: 610,
    quarantineStock: 0,
    leadTimeDays: 4,
    dynamicSafetyStock: 73,
    reorderPoint: 513,
    needsProcurement: false,
    recommendedOrderQty: 0,
    forecast: {
      forecastNextPeriod: 774,
      completenessPercent: 66.7,
      validIntervals: 8,
      totalIntervals: 12,
      missingPeriods: ['M1-W3', 'M2-W2', 'M3-W1', 'M3-W4'],
      qualityIndicator: 'INCOMPLETE_DATA_WARNING',
      methodUsed: 'HYBRID_WMA',
      advisoryNote: 'Kelengkapan data 66.7% (4 interval hilang). Menggunakan Weighted Moving Average (WMA) hibrida untuk mencegah bias model AI kompleks.',
    },
  },
];

export const INITIAL_AUDIT_LOGS: AuditEntryDto[] = [
  {
    id: 'aud-init-1',
    entityType: 'Warehouse',
    entityId: 'WH-04',
    action: 'WAREHOUSE_INITIAL_SYNC',
    actorRole: 'WAREHOUSE_OPERATOR',
    reason: 'Sinkronisasi awal 8 gudang berhasil (0 konflik).',
    createdAt: '2026-11-16T07:00:00.000Z',
  },
  {
    id: 'aud-init-2',
    entityType: 'InventoryStock',
    entityId: 'stk-wh04',
    action: 'CYCLE_COUNT_OBSERVED',
    actorRole: 'WAREHOUSE_OPERATOR',
    reason: 'Pemeriksaan fisik Gudang #04 (Surabaya) mencatat 320 unit vs RFID 500 unit.',
    createdAt: '2026-11-16T07:02:00.000Z',
  },
];
