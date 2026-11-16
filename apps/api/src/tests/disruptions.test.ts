import assert from 'node:assert/strict';
import test from 'node:test';
import { createAnalyticsService } from '../modules/analytics/analytics.service.js';
import { allocateOrdersWithAnomalyGuard } from '../modules/orders/orders.domain.js';
import { createOrdersService } from '../modules/orders/orders.service.js';
import { createSrmService } from '../modules/srm/srm.service.js';
import { createTmsService } from '../modules/tms/tms.service.js';
import type { ManagedUserRow } from '../modules/users/users.repository.js';
import { createUsersService } from '../modules/users/users.service.js';
import { createWmsService } from '../modules/wms/wms.service.js';
import { requireRoles } from '../middleware/auth.js';
import { createInMemoryAuditWriter, createInMemoryRepositories } from './helpers/mockStore.js';

test('Scenario 1: Main supplier halts 14 days -> triggers backup Tier-2 RFQ & updates ROP', async () => {
  const audit = createInMemoryAuditWriter();
  const { srmRepo, state } = createInMemoryRepositories();
  const srmService = createSrmService(srmRepo, audit);

  const result = await srmService.triggerRfqFallback({
    haltedSupplierIdOrCode: 'SUP-01',
    haltedDays: 14,
    actorId: 'mgr-pengadaan',
    actorRole: 'PROCUREMENT_MANAGER',
  });

  assert.equal(result.haltedSupplier.code, 'SUP-01');
  assert.equal(result.haltedSupplier.status, 'HALTED');
  assert.equal(result.backupSupplier.code, 'SUP-16');
  assert.equal(result.rfqOrder.isRfqFallback, true);
  assert.equal(result.rfqOrder.status, 'DRAFT_RFQ');
  assert.ok(result.adjustedReorderPoint > 307, 'ROP should increase for longer backup lead time');
  assert.equal(state.purchaseOrders.length, 1);
  assert.equal(audit.entries.at(-1)?.action, 'SRM_RFQ_FALLBACK_TRIGGERED');
});

test('Scenario 2: Demand surges +300% -> dynamic Safety Stock scales & allocation prioritizes SLA Tier-1', async () => {
  const { analyticsRepo } = createInMemoryRepositories();
  const analyticsService = createAnalyticsService(analyticsRepo);

  const normalForecast = await analyticsService.getForecastOverview({ demandSurgeMultiplier: 1 });
  const surgeForecast = await analyticsService.getForecastOverview({ demandSurgeMultiplier: 3 });

  const normalMat = normalForecast.materials[0]!;
  const surgeMat = surgeForecast.materials[0]!;
  assert.ok(surgeMat.dynamicSafetyStock >= normalMat.dynamicSafetyStock * 2.5);
  assert.ok(surgeMat.reorderPoint > normalMat.reorderPoint * 2);

  // Allocation under scarce stock (150 units available for 2 valid orders of 120 and 95 units)
  const allocation = allocateOrdersWithAnomalyGuard(
    [
      {
        id: 'o-low',
        orderNumber: 'ORD-LOW',
        distributorId: 'dist-3',
        distributorCode: 'DIST-03',
        distributorName: 'PT Surya Mandiri',
        slaTier: 'TIER_3',
        slaScore: 76,
        monthlyQuota: 110,
        creditLimit: 250_000_000,
        usedCredit: 0,
        requestedQty: 95,
        unitPrice: 420_000,
        depositConfirmed: true,
        createdAt: new Date('2026-11-16T08:00:00Z'),
      },
      {
        id: 'o-high',
        orderNumber: 'ORD-HIGH',
        distributorId: 'dist-1',
        distributorCode: 'DIST-01',
        distributorName: 'PT Distribusi Timur',
        slaTier: 'TIER_1',
        slaScore: 96,
        monthlyQuota: 130,
        creditLimit: 250_000_000,
        usedCredit: 0,
        requestedQty: 120,
        unitPrice: 420_000,
        depositConfirmed: true,
        createdAt: new Date('2026-11-16T08:05:00Z'),
      },
    ],
    150,
  );

  const tier1Decision = allocation.decisions.find((d) => d.orderNumber === 'ORD-HIGH')!;
  const tier3Decision = allocation.decisions.find((d) => d.orderNumber === 'ORD-LOW')!;
  assert.equal(tier1Decision.allocatedQty, 120);
  assert.equal(tier1Decision.allocationStatus, 'APPROVED_SLA');
  assert.equal(tier3Decision.allocatedQty, 30);
  assert.equal(tier3Decision.allocationStatus, 'PARTIAL_ALLOCATED');
  assert.equal(allocation.remainingStock, 0);
});

test('Scenario 3: Warehouse offline 48h -> Store-and-Forward batch sync recovers chronologically without duplicate mutation', async () => {
  const audit = createInMemoryAuditWriter();
  const { wmsRepo, state } = createInMemoryRepositories();
  const wmsService = createWmsService(wmsRepo, audit);

  const batchPayload = [
    {
      idempotencyKey: 'wh04-scan-002',
      stockId: 'stk-wh04',
      deltaQty: 10,
      direction: 'IN' as const,
      offlineTimestamp: '2026-11-15T10:15:00.000Z',
      wasOffline: true,
    },
    {
      idempotencyKey: 'wh04-scan-001',
      stockId: 'stk-wh04',
      deltaQty: 25,
      direction: 'IN' as const,
      offlineTimestamp: '2026-11-15T09:00:00.000Z',
      wasOffline: true,
    },
  ];

  const firstRun = await wmsService.syncBatch(batchPayload, {
    id: 'op-wh04',
    role: 'WAREHOUSE_OPERATOR',
  });
  assert.equal(firstRun.appliedCount, 2);
  assert.equal(firstRun.skippedDuplicateKeys.length, 0);
  assert.equal(state.stocks[0]!.rfidQty, 535);
  assert.equal(state.stocks[0]!.physicalQty, 355);

  // Replay exact same batch -> idempotency keys must prevent double counting
  const replayRun = await wmsService.syncBatch(batchPayload, {
    id: 'op-wh04',
    role: 'WAREHOUSE_OPERATOR',
  });
  assert.equal(replayRun.appliedCount, 0);
  assert.equal(replayRun.skippedDuplicateKeys.length, 2);
  assert.equal(state.stocks[0]!.rfidQty, 535);
  assert.equal(state.stocks[0]!.physicalQty, 355);
});

test('Scenario 4: RFID 500 vs physical 320 -> reconciles 180 units into quarantine + immutable AuditLog', async () => {
  const audit = createInMemoryAuditWriter();
  const { wmsRepo, state } = createInMemoryRepositories();
  const wmsService = createWmsService(wmsRepo, audit);

  const rec = await wmsService.reconcileCycleCount(
    { stockId: 'stk-wh04' },
    { id: 'op-wh04', role: 'WAREHOUSE_OPERATOR' },
  );

  assert.equal(rec.previousRfidQty, 500);
  assert.equal(rec.physicalQty, 320);
  assert.equal(rec.discrepancyQty, 180);
  assert.equal(rec.newQuarantineQty, 180);
  assert.equal(rec.newAvailableRfidQty, 320);
  assert.equal(state.stocks[0]!.quarantineQty, 180);
  assert.equal(audit.entries.at(-1)?.action, 'WMS_CYCLE_COUNT_RECONCILED');
});

test('Scenario 5: Fictitious order (480 vs 150 quota = 320%) -> Anomaly Guard holds order before locking stock', async () => {
  const audit = createInMemoryAuditWriter();
  const { ordersRepo } = createInMemoryRepositories();
  const ordersService = createOrdersService(ordersRepo, audit);

  const fakeAttempt = await ordersService.validateAndAllocateOrder({
    distributorIdOrCode: 'DIST-02',
    materialIdOrSku: 'MAT-01',
    requestedQty: 480,
    depositConfirmed: false,
    actorId: 'mgr-logistik',
    actorRole: 'LOGISTICS_MANAGER',
  });

  assert.equal(fakeAttempt.assessment.isAnomaly, true);
  assert.equal(fakeAttempt.assessment.exceedsQuota, true);
  assert.equal(fakeAttempt.order.allocationStatus, 'HELD_ANOMALY');
  assert.equal(fakeAttempt.order.allocatedQty, 0);
  assert.equal(audit.entries.at(-1)?.action, 'ORDER_HELD_ANOMALY_GUARD');

  // Normal order within quota succeeds
  const validAttempt = await ordersService.validateAndAllocateOrder({
    distributorIdOrCode: 'DIST-01',
    materialIdOrSku: 'MAT-01',
    requestedQty: 120,
    depositConfirmed: true,
    actorId: 'mgr-logistik',
    actorRole: 'LOGISTICS_MANAGER',
  });
  assert.equal(validAttempt.assessment.isAnomaly, false);
  assert.equal(validAttempt.order.allocationStatus, 'APPROVED_SLA');
  assert.equal(validAttempt.order.allocatedQty, 120);
});

test('Scenario 6: Transport cost +40% & incomplete 3-month data -> TMS consolidation saves 28% & Hybrid WMA warns on gaps', async () => {
  const audit = createInMemoryAuditWriter();
  const { tmsRepo, analyticsRepo } = createInMemoryRepositories();
  const tmsService = createTmsService(tmsRepo, audit);
  const analyticsService = createAnalyticsService(analyticsRepo);

  const tmsPlan = await tmsService.consolidateRoutes(
    { routeGroup: 'JAWA_BARAT', transportSurgePercent: 40 },
    { id: 'mgr-logistik', role: 'LOGISTICS_MANAGER' },
  );

  assert.equal(tmsPlan.batches.length, 1);
  assert.equal(tmsPlan.totalSavingsPercent, 28);
  assert.ok(tmsPlan.totalConsolidatedCost < tmsPlan.totalOriginalCost);

  const forecast = await analyticsService.getForecastOverview();
  const matForecast = forecast.materials[0]!.forecast;
  assert.equal(forecast.overallDataQuality, 'INCOMPLETE_DATA_WARNING');
  assert.equal(matForecast.methodUsed, 'HYBRID_WMA');
  assert.equal(matForecast.validIntervals, 8);
  assert.equal(matForecast.totalIntervals, 12);
  assert.equal(matForecast.completenessPercent, 66.7);
  assert.ok(matForecast.forecastNextPeriod > 0);
});

test('RBAC guard denies unauthorized PARTNER role from internal warehouse reconciliation', () => {
  const guard = requireRoles('WAREHOUSE_OPERATOR', 'DIREKSI');
  let capturedError: unknown = null;

  guard(
    {
      user: {
        id: 'partner-1',
        email: 'mitra@bajanusantara.co.id',
        name: 'Mitra Eksternal',
        role: 'PARTNER',
      },
    } as never,
    {} as never,
    (err?: unknown) => {
      capturedError = err ?? null;
    },
  );

  assert.ok(capturedError instanceof Error);
  assert.equal((capturedError as { statusCode?: number }).statusCode, 403);
});

test('Separation of Duties: SYSTEM_ADMIN manages users with audit log but is blocked from operational WMS/SRM writes', async () => {
  // 1. SYSTEM_ADMIN is denied 403 on operational warehouse & procurement endpoints
  const wmsGuard = requireRoles('WAREHOUSE_OPERATOR');
  let wmsError: unknown = null;
  wmsGuard(
    {
      user: {
        id: 'admin-1',
        email: 'admin@nusantara-mfg.co.id',
        name: 'Irwan Hakim',
        role: 'SYSTEM_ADMIN',
      },
    } as never,
    {} as never,
    (err?: unknown) => {
      wmsError = err ?? null;
    },
  );
  assert.equal((wmsError as { statusCode?: number }).statusCode, 403);

  // 2. SYSTEM_ADMIN can create & deactivate accounts while preventing self-deactivation
  const audit = createInMemoryAuditWriter();
  const store: ManagedUserRow[] = [
    {
      id: 'admin-1',
      email: 'admin@nusantara-mfg.co.id',
      name: 'Irwan Hakim',
      role: 'SYSTEM_ADMIN',
      entityCode: null,
      isActive: true,
      createdAt: new Date(),
    },
  ];
  const usersService = createUsersService(
    {
      async listAll() {
        return [...store];
      },
      async findById(id) {
        return store.find((u) => u.id === id) ?? null;
      },
      async findByEmail(email) {
        return store.find((u) => u.email === email) ?? null;
      },
      async create(input) {
        const created = {
          id: `usr-${store.length + 1}`,
          email: input.email,
          name: input.name,
          role: input.role,
          entityCode: input.entityCode,
          isActive: true,
          createdAt: new Date(),
        };
        store.push(created);
        return created;
      },
      async updateAccess(id, patch) {
        const target = store.find((u) => u.id === id)!;
        if (patch.role !== undefined) target.role = patch.role;
        if (patch.entityCode !== undefined) target.entityCode = patch.entityCode;
        if (patch.isActive !== undefined) target.isActive = patch.isActive;
        return { ...target };
      },
      async updatePasswordHash() {},
    },
    audit,
  );

  const createdUser = await usersService.createUser(
    {
      email: 'operator.baru@nusantara-mfg.co.id',
      name: 'Andi Gudang',
      role: 'WAREHOUSE_OPERATOR',
      password: 'Password123',
    },
    { id: 'admin-1', role: 'SYSTEM_ADMIN' },
  );
  assert.equal(createdUser.role, 'WAREHOUSE_OPERATOR');
  assert.equal(audit.entries.at(-1)?.action, 'USER_ACCOUNT_CREATED');

  await assert.rejects(
    () =>
      usersService.updateUserAccess(
        'admin-1',
        { isActive: false },
        { id: 'admin-1', role: 'SYSTEM_ADMIN' },
      ),
    /menonaktifkan akunnya sendiri/,
  );
});
