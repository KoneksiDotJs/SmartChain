import { PrismaClient } from '@prisma/client';
import { ensureEnvLoaded } from '../src/config/env.js';
import { hashPassword } from '../src/modules/auth/auth.service.js';

ensureEnvLoaded();
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding SmartChain PT Nusantara Manufacturing dataset...');

  // Clean in reverse dependency order (AuditLog is left append-only unless resetting dev DB)
  await prisma.shipment.deleteMany();
  await prisma.salesOrder.deleteMany();
  await prisma.rfidSyncLog.deleteMany();
  await prisma.inventoryStock.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.demandHistory.deleteMany();
  await prisma.distributor.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.materialProduct.deleteMany();
  await prisma.factory.deleteMany();
  await prisma.userAccount.deleteMany();

  // 1. User Accounts (5 RBAC Roles)
  const defaultHash = hashPassword('smartchain123');
  await prisma.userAccount.createMany({
    data: [
      {
        email: 'direksi@nusantara-mfg.co.id',
        name: 'Dewi Kartika (Direksi)',
        role: 'DIREKSI',
        passwordHash: defaultHash,
      },
      {
        email: 'pengadaan@nusantara-mfg.co.id',
        name: 'Budi Santoso (Manajer Pengadaan)',
        role: 'PROCUREMENT_MANAGER',
        passwordHash: defaultHash,
      },
      {
        email: 'gudang@nusantara-mfg.co.id',
        name: 'Rina Wijaya (Operator Gudang #04)',
        role: 'WAREHOUSE_OPERATOR',
        passwordHash: defaultHash,
      },
      {
        email: 'logistik@nusantara-mfg.co.id',
        name: 'Hendra Pratama (Manajer Logistik)',
        role: 'LOGISTICS_MANAGER',
        passwordHash: defaultHash,
      },
      {
        email: 'mitra@bajanusantara.co.id',
        name: 'PT Baja Nusantara (Mitra Eksternal)',
        role: 'PARTNER',
        entityCode: 'SUP-01',
        passwordHash: defaultHash,
      },
    ],
  });

  // 2. 3 Factories
  const factories = await Promise.all([
    prisma.factory.create({
      data: { code: 'FAC-01', name: 'Pabrik Cikarang (Utama)', city: 'Bekasi', dailyCapacity: 1200 },
    }),
    prisma.factory.create({
      data: { code: 'FAC-02', name: 'Pabrik Gresik', city: 'Gresik', dailyCapacity: 950 },
    }),
    prisma.factory.create({
      data: { code: 'FAC-03', name: 'Pabrik Semarang', city: 'Semarang', dailyCapacity: 800 },
    }),
  ]);

  // 3. Materials / Products
  const materials = await Promise.all([
    prisma.materialProduct.create({
      data: {
        sku: 'MAT-01',
        name: 'Baja Lembaran Canai Dingin',
        category: 'LOGAM',
        unit: 'unit',
        unitCost: 420_000,
        dailyDemandAvg: 65,
        demandStdDev: 14,
        leadTimeDays: 4,
        safetyStock: 47,
        reorderPoint: 307,
      },
    }),
    prisma.materialProduct.create({
      data: {
        sku: 'MAT-02',
        name: 'Resin Polimer Industri Grade-A',
        category: 'POLIMER',
        unit: 'unit',
        unitCost: 275_000,
        dailyDemandAvg: 80,
        demandStdDev: 18,
        leadTimeDays: 3,
        safetyStock: 52,
        reorderPoint: 292,
      },
    }),
    prisma.materialProduct.create({
      data: {
        sku: 'MAT-03',
        name: 'Komponen Pengikat Presisi',
        category: 'KOMPONEN',
        unit: 'unit',
        unitCost: 135_000,
        dailyDemandAvg: 110,
        demandStdDev: 22,
        leadTimeDays: 4,
        safetyStock: 73,
        reorderPoint: 513,
      },
    }),
    prisma.materialProduct.create({
      data: {
        sku: 'MAT-04',
        name: 'Kemasan Karton Pelindung Ekspor',
        category: 'KEMASAN',
        unit: 'unit',
        unitCost: 48_000,
        dailyDemandAvg: 150,
        demandStdDev: 25,
        leadTimeDays: 2,
        safetyStock: 59,
        reorderPoint: 359,
      },
    }),
  ]);

  // 4. 15 Main Suppliers + 5 Backup Tier-2 Suppliers
  const supplierSeed = [
    { code: 'SUP-01', name: 'PT Baja Nusantara', tierType: 'MAIN', slaScore: 96, leadTimeDays: 4, status: 'HALTED', haltedDays: 14, materialCategory: 'LOGAM', city: 'Cilegon' },
    { code: 'SUP-02', name: 'PT Krakatau Logam Abadi', tierType: 'MAIN', slaScore: 95, leadTimeDays: 4, status: 'ACTIVE', haltedDays: 0, materialCategory: 'LOGAM', city: 'Serang' },
    { code: 'SUP-03', name: 'CV Polimer Sejahtera', tierType: 'MAIN', slaScore: 93, leadTimeDays: 3, status: 'ACTIVE', haltedDays: 0, materialCategory: 'POLIMER', city: 'Tangerang' },
    { code: 'SUP-04', name: 'CV Logam Makmur', tierType: 'MAIN', slaScore: 94, leadTimeDays: 3, status: 'ACTIVE', haltedDays: 0, materialCategory: 'LOGAM', city: 'Surabaya' },
    { code: 'SUP-05', name: 'PT Kimia Sintesa Jaya', tierType: 'MAIN', slaScore: 92, leadTimeDays: 4, status: 'ACTIVE', haltedDays: 0, materialCategory: 'POLIMER', city: 'Bekasi' },
    { code: 'SUP-06', name: 'PT Presisi Teknik Utama', tierType: 'MAIN', slaScore: 95, leadTimeDays: 4, status: 'ACTIVE', haltedDays: 0, materialCategory: 'KOMPONEN', city: 'Bandung' },
    { code: 'SUP-07', name: 'CV Mur Baut Sentosa', tierType: 'MAIN', slaScore: 90, leadTimeDays: 5, status: 'ACTIVE', haltedDays: 0, materialCategory: 'KOMPONEN', city: 'Sidoarjo' },
    { code: 'SUP-08', name: 'PT Karton Kemas Prima', tierType: 'MAIN', slaScore: 94, leadTimeDays: 2, status: 'ACTIVE', haltedDays: 0, materialCategory: 'KEMASAN', city: 'Karawang' },
    { code: 'SUP-09', name: 'PT Aneka Plat Indonesia', tierType: 'MAIN', slaScore: 91, leadTimeDays: 5, status: 'ACTIVE', haltedDays: 0, materialCategory: 'LOGAM', city: 'Gresik' },
    { code: 'SUP-10', name: 'PT Indo Resin Mandiri', tierType: 'MAIN', slaScore: 89, leadTimeDays: 4, status: 'ACTIVE', haltedDays: 0, materialCategory: 'POLIMER', city: 'Cikarang' },
    { code: 'SUP-11', name: 'PT Fastener Nusantara', tierType: 'MAIN', slaScore: 92, leadTimeDays: 3, status: 'ACTIVE', haltedDays: 0, materialCategory: 'KOMPONEN', city: 'Semarang' },
    { code: 'SUP-12', name: 'CV Packaging Jaya', tierType: 'MAIN', slaScore: 88, leadTimeDays: 3, status: 'ACTIVE', haltedDays: 0, materialCategory: 'KEMASAN', city: 'Solo' },
    { code: 'SUP-13', name: 'PT Sinar Metalurgi', tierType: 'MAIN', slaScore: 93, leadTimeDays: 4, status: 'ACTIVE', haltedDays: 0, materialCategory: 'LOGAM', city: 'Jakarta' },
    { code: 'SUP-14', name: 'PT Petro Polimer Timur', tierType: 'MAIN', slaScore: 90, leadTimeDays: 5, status: 'ACTIVE', haltedDays: 0, materialCategory: 'POLIMER', city: 'Pasuruan' },
    { code: 'SUP-15', name: 'PT Karya Kemas Nusantara', tierType: 'MAIN', slaScore: 91, leadTimeDays: 3, status: 'ACTIVE', haltedDays: 0, materialCategory: 'KEMASAN', city: 'Mojokerto' },
    // 5 Backup Tier-2 Suppliers
    { code: 'SUP-16', name: 'PT Mitra Bahan Cadangan', tierType: 'BACKUP', slaScore: 91, leadTimeDays: 5, status: 'STANDBY', haltedDays: 0, materialCategory: 'LOGAM', city: 'Bekasi' },
    { code: 'SUP-17', name: 'PT Cadangan Polimer Prima', tierType: 'BACKUP', slaScore: 90, leadTimeDays: 4, status: 'STANDBY', haltedDays: 0, materialCategory: 'POLIMER', city: 'Depok' },
    { code: 'SUP-18', name: 'CV Komponen Siaga', tierType: 'BACKUP', slaScore: 88, leadTimeDays: 5, status: 'STANDBY', haltedDays: 0, materialCategory: 'KOMPONEN', city: 'Klaten' },
    { code: 'SUP-19', name: 'PT Kemas Cepat Cadangan', tierType: 'BACKUP', slaScore: 89, leadTimeDays: 3, status: 'STANDBY', haltedDays: 0, materialCategory: 'KEMASAN', city: 'Subang' },
    { code: 'SUP-20', name: 'PT Multi Logam Alternatif', tierType: 'BACKUP', slaScore: 87, leadTimeDays: 6, status: 'STANDBY', haltedDays: 0, materialCategory: 'LOGAM', city: 'Surabaya' },
  ] as const;

  const suppliers = await Promise.all(
    supplierSeed.map((s) =>
      prisma.supplier.create({
        data: {
          code: s.code,
          name: s.name,
          tierType: s.tierType,
          slaScore: s.slaScore,
          leadTimeDays: s.leadTimeDays,
          status: s.status,
          haltedDays: s.haltedDays,
          haltedAt: s.status === 'HALTED' ? new Date() : null,
          materialCategory: s.materialCategory,
          city: s.city,
        },
      }),
    ),
  );

  // 5. 8 Warehouses (WH-04 Surabaya simulates 48-hour offline + RFID 500 vs Physical 320 anomaly)
  const warehouseSeed = [
    { code: 'WH-01', name: 'Gudang #01 (Cikarang Pusat)', city: 'Bekasi', region: 'JAWA_BARAT', networkStatus: 'ONLINE', offlineHours: 0 },
    { code: 'WH-02', name: 'Gudang #02 (Bandung Barat)', city: 'Bandung', region: 'JAWA_BARAT', networkStatus: 'ONLINE', offlineHours: 0 },
    { code: 'WH-03', name: 'Gudang #03 (Semarang Pelabuhan)', city: 'Semarang', region: 'JAWA_TENGAH', networkStatus: 'ONLINE', offlineHours: 0 },
    { code: 'WH-04', name: 'Gudang #04 (Surabaya)', city: 'Surabaya', region: 'JAWA_TIMUR', networkStatus: 'OFFLINE', offlineHours: 48 },
    { code: 'WH-05', name: 'Gudang #05 (Gresik Industri)', city: 'Gresik', region: 'JAWA_TIMUR', networkStatus: 'ONLINE', offlineHours: 0 },
    { code: 'WH-06', name: 'Gudang #06 (Solo Distribusi)', city: 'Surakarta', region: 'JAWA_TENGAH', networkStatus: 'ONLINE', offlineHours: 0 },
    { code: 'WH-07', name: 'Gudang #07 (Cilegon Bahan Baku)', city: 'Cilegon', region: 'JAWA_BARAT', networkStatus: 'ONLINE', offlineHours: 0 },
    { code: 'WH-08', name: 'Gudang #08 (Sidoarjo Transit)', city: 'Sidoarjo', region: 'JAWA_TIMUR', networkStatus: 'ONLINE', offlineHours: 0 },
  ] as const;

  const warehouses = await Promise.all(
    warehouseSeed.map((w) =>
      prisma.warehouse.create({
        data: {
          code: w.code,
          name: w.name,
          city: w.city,
          region: w.region,
          networkStatus: w.networkStatus,
          offlineHours: w.offlineHours,
          lastSyncAt:
            w.networkStatus === 'OFFLINE'
              ? new Date(Date.now() - 48 * 3_600_000)
              : new Date(),
        },
      }),
    ),
  );

  // Seed InventoryStock across 8 warehouses; WH-04 MAT-01 holds the exact 500 vs 320 anomaly
  let wh04StockId = '';
  for (let wi = 0; wi < warehouses.length; wi += 1) {
    const wh = warehouses[wi]!;
    for (let mi = 0; mi < materials.length; mi += 1) {
      const mat = materials[mi]!;
      const isAnomalyCell = wh.code === 'WH-04' && mat.sku === 'MAT-01';
      const rfidQty = isAnomalyCell ? 500 : 280 + wi * 25 + mi * 15;
      const physicalQty = isAnomalyCell ? 320 : rfidQty;

      const createdStock = await prisma.inventoryStock.create({
        data: {
          warehouseId: wh.id,
          materialId: mat.id,
          rfidQty,
          physicalQty,
          quarantineQty: 0,
          rop: Math.round(mat.reorderPoint / 8),
          safetyStock: Math.round(mat.safetyStock / 8),
        },
      });
      if (isAnomalyCell) wh04StockId = createdStock.id;
    }
  }

  // 6. 25 Distributors across 4 route groups & 3 SLA tiers
  const routeGroups = ['JAWA_BARAT', 'JAWA_TENGAH', 'JAWA_TIMUR', 'LUAR_JAWA'] as const;
  const citiesByRoute = {
    JAWA_BARAT: ['Jakarta', 'Bekasi', 'Bandung', 'Bogor', 'Cirebon', 'Tangerang', 'Karawang'],
    JAWA_TENGAH: ['Semarang', 'Solo', 'Yogyakarta', 'Magelang', 'Tegal', 'Purwokerto'],
    JAWA_TIMUR: ['Surabaya', 'Sidoarjo', 'Malang', 'Gresik', 'Kediri', 'Mojokerto'],
    LUAR_JAWA: ['Medan', 'Palembang', 'Makassar', 'Balikpapan', 'Denpasar', 'Lampung'],
  };

  const distributors = [];
  for (let i = 1; i <= 25; i += 1) {
    const code = `DIST-${String(i).padStart(2, '0')}`;
    const routeGroup = routeGroups[(i - 1) % routeGroups.length]!;
    const cityPool = citiesByRoute[routeGroup];
    const city = cityPool[(i - 1) % cityPool.length]!;
    const slaTier = i <= 8 ? 'TIER_1' : i <= 18 ? 'TIER_2' : 'TIER_3';
    const slaScore = slaTier === 'TIER_1' ? 96 - (i % 3) : slaTier === 'TIER_2' ? 88 - (i % 4) : 78 - (i % 5);
    const monthlyQuota = i === 2 ? 150 : 110 + (i % 5) * 20;

    const customName =
      i === 1
        ? 'PT Distribusi Timur'
        : i === 2
          ? 'CV Sentosa Jaya'
          : i === 3
            ? 'PT Surya Mandiri'
            : `PT Mitra Niaga ${city} ${i}`;

    const dist = await prisma.distributor.create({
      data: {
        code,
        name: customName,
        city,
        routeGroup,
        slaTier,
        slaScore,
        monthlyQuota,
        creditLimit: 250_000_000,
        usedCredit: i === 2 ? 180_000_000 : 45_000_000,
      },
    });
    distributors.push(dist);
  }

  // 7. Initial Purchase Orders
  await prisma.purchaseOrder.create({
    data: {
      poNumber: 'PO-2026-001',
      supplierId: suppliers[3]!.id, // SUP-04
      materialId: materials[0]!.id,
      factoryId: factories[0]!.id,
      quantity: 450,
      isRfqFallback: false,
      triggeredByRop: true,
      status: 'APPROVED',
      expectedDate: new Date(Date.now() + 3 * 86_400_000),
      notes: 'Pengadaan reguler Pabrik Cikarang berbasis ROP',
    },
  });

  // 8. Sample Sales Orders (including ORD-882 fictitious spike 480 vs quota 150) & Shipments
  const ord881 = await prisma.salesOrder.create({
    data: {
      orderNumber: 'ORD-881',
      distributorId: distributors[0]!.id, // PT Distribusi Timur (TIER_1)
      materialId: materials[0]!.id,
      requestedQty: 120,
      allocatedQty: 120,
      unitPrice: 420_000,
      totalAmount: 120 * 420_000,
      anomalyFlag: false,
      slaPriority: 396,
      allocationStatus: 'APPROVED_SLA',
      depositConfirmed: true,
    },
  });

  await prisma.salesOrder.create({
    data: {
      orderNumber: 'ORD-882',
      distributorId: distributors[1]!.id, // CV Sentosa Jaya (480 vs 150 quota = 320% anomaly!)
      materialId: materials[0]!.id,
      requestedQty: 480,
      allocatedQty: 0,
      unitPrice: 420_000,
      totalAmount: 480 * 420_000,
      anomalyFlag: true,
      anomalyReason: 'Volume pesanan (480 unit) mencapai 320% dari kuota historis (150 unit) tanpa konfirmasi deposit.',
      slaPriority: 395,
      allocationStatus: 'HELD_ANOMALY',
      depositConfirmed: false,
    },
  });

  const ord883 = await prisma.salesOrder.create({
    data: {
      orderNumber: 'ORD-883',
      distributorId: distributors[2]!.id, // PT Surya Mandiri (TIER_1)
      materialId: materials[0]!.id,
      requestedQty: 95,
      allocatedQty: 95,
      unitPrice: 420_000,
      totalAmount: 95 * 420_000,
      anomalyFlag: false,
      slaPriority: 394,
      allocationStatus: 'APPROVED_SLA',
      depositConfirmed: true,
    },
  });

  const ord884 = await prisma.salesOrder.create({
    data: {
      orderNumber: 'ORD-884',
      distributorId: distributors[4]!.id, // Same JAWA_BARAT corridor as ord881
      materialId: materials[1]!.id,
      requestedQty: 105,
      allocatedQty: 105,
      unitPrice: 275_000,
      totalAmount: 105 * 275_000,
      anomalyFlag: false,
      slaPriority: 394,
      allocationStatus: 'APPROVED_SLA',
      depositConfirmed: true,
    },
  });

  const ord885 = await prisma.salesOrder.create({
    data: {
      orderNumber: 'ORD-885',
      distributorId: distributors[6]!.id, // Same JAWA_TIMUR corridor as ord883
      materialId: materials[2]!.id,
      requestedQty: 110,
      allocatedQty: 110,
      unitPrice: 135_000,
      totalAmount: 110 * 135_000,
      anomalyFlag: false,
      slaPriority: 393,
      allocationStatus: 'APPROVED_SLA',
      depositConfirmed: true,
    },
  });

  await prisma.shipment.createMany({
    data: [
      {
        shipmentNumber: 'SHP-2026-01',
        orderId: ord881.id,
        warehouseId: warehouses[0]!.id,
        routeGroup: distributors[0]!.routeGroup,
        carrierName: 'Ekspedisi Nusantara Darat',
        baseCost: 5_800_000,
        consolidatedCost: 5_800_000,
        isConsolidated: false,
        trackingStatus: 'PLANNED',
        estimatedArrival: new Date(Date.now() + 2 * 86_400_000),
      },
      {
        shipmentNumber: 'SHP-2026-02',
        orderId: ord884.id,
        warehouseId: warehouses[0]!.id,
        routeGroup: distributors[4]!.routeGroup,
        carrierName: 'Ekspedisi Nusantara Darat',
        baseCost: 5_400_000,
        consolidatedCost: 5_400_000,
        isConsolidated: false,
        trackingStatus: 'PLANNED',
        estimatedArrival: new Date(Date.now() + 2 * 86_400_000),
      },
      {
        shipmentNumber: 'SHP-2026-03',
        orderId: ord883.id,
        warehouseId: warehouses[3]!.id,
        routeGroup: distributors[2]!.routeGroup,
        carrierName: 'Logistik Timur Trans',
        baseCost: 4_900_000,
        consolidatedCost: 4_900_000,
        isConsolidated: false,
        trackingStatus: 'PLANNED',
        estimatedArrival: new Date(Date.now() + 3 * 86_400_000),
      },
      {
        shipmentNumber: 'SHP-2026-04',
        orderId: ord885.id,
        warehouseId: warehouses[4]!.id,
        routeGroup: distributors[6]!.routeGroup,
        carrierName: 'Logistik Timur Trans',
        baseCost: 5_100_000,
        consolidatedCost: 5_100_000,
        isConsolidated: false,
        trackingStatus: 'PLANNED',
        estimatedArrival: new Date(Date.now() + 3 * 86_400_000),
      },
    ],
  });

  // 9. Incomplete 3-Month (12-week) Historical Demand Data (explicit missing/null intervals)
  const weeklySeries: Array<number | null> = [
    410, 435, null, 460,
    490, null, 515, 530,
    null, 555, 580, null,
  ];

  for (let mi = 0; mi < materials.length; mi += 1) {
    const mat = materials[mi]!;
    const scale = 1 + mi * 0.25;
    await prisma.demandHistory.createMany({
      data: weeklySeries.map((val, idx) => ({
        materialId: mat.id,
        periodLabel: `M${Math.floor(idx / 4) + 1}-W${(idx % 4) + 1}`,
        periodIndex: idx + 1,
        observedQty: val === null ? null : Math.round(val * scale),
        isMissing: val === null,
      })),
    });
  }

  // 10. Initial Immutable Audit Log entries
  await prisma.auditLog.createMany({
    data: [
      {
        entityType: 'Warehouse',
        entityId: warehouses[3]!.id,
        action: 'WAREHOUSE_OFFLINE_DETECTED',
        actorId: 'system-monitor',
        actorRole: 'SYSTEM',
        newState: { warehouseCode: 'WH-04', offlineHours: 48, stockId: wh04StockId },
        reason: 'Gudang #04 (Surabaya) terputus jaringan selama 48 jam; antrean lokal aktif.',
      },
      {
        entityType: 'InventoryStock',
        entityId: wh04StockId,
        action: 'RFID_PHYSICAL_VARIANCE_FLAGGED',
        actorId: 'gudang-04-audit',
        actorRole: 'WAREHOUSE_OPERATOR',
        newState: { rfidQty: 500, physicalQty: 320, discrepancy: 180 },
        reason: 'Pemeriksaan fisik Gudang #04 mencatat 320 unit dibanding RFID 500 unit.',
      },
      {
        entityType: 'SalesOrder',
        entityId: 'ORD-882',
        action: 'ORDER_HELD_ANOMALY_GUARD',
        actorId: 'anomaly-guard',
        actorRole: 'SYSTEM',
        newState: { distributor: 'CV Sentosa Jaya', requestedQty: 480, monthlyQuota: 150 },
        reason: 'Pesanan fiktif terdeteksi (320% dari kuota bulanan) — ditahan sebelum penguncian stok.',
      },
    ],
  });

  console.log('Seed completed: 3 factories, 20 suppliers (15 main + 5 backup), 8 warehouses, 25 distributors, dirty history & anomalies.');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
