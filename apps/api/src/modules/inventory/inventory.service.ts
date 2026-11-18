import { buildEntityTraceabilityChain } from './inventory.domain.js';
import type { InventoryRepository } from './inventory.repository.js';

export function createInventoryService(repo: InventoryRepository) {
  return {
    async getLedger(filters?: { materialSku?: string; warehouseCode?: string }) {
      const items = await repo.getLedger(filters);
      return {
        items,
        totals: {
          physicalUnits: items.reduce((sum, i) => sum + i.physicalQty, 0),
          rfidUnits: items.reduce((sum, i) => sum + i.rfidQty, 0),
          quarantineUnits: items.reduce((sum, i) => sum + i.quarantineQty, 0),
          belowRopCount: items.filter((i) => i.healthStatus === 'BELOW_ROP').length,
          discrepancyCount: items.filter((i) => i.healthStatus === 'DISCREPANCY_ALERT').length,
        },
      };
    },

    async getTraceability(filters?: { materialSku?: string; warehouseCode?: string }) {
      const snapshot = await repo.getTraceabilitySnapshot(filters);
      return buildEntityTraceabilityChain(snapshot);
    },
  };
}
