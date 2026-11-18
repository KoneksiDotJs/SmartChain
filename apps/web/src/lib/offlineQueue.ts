export interface QueuedRfidScan {
  idempotencyKey: string;
  stockId: string;
  warehouseCode: string;
  deltaQty: number;
  direction: 'IN' | 'OUT' | 'CYCLE_COUNT';
  offlineTimestamp: string;
  wasOffline: boolean;
}

const DB_NAME = 'smartchain-wms-edge';
const DB_VERSION = 1;
const STORE_NAME = 'scan_queue';

let memoryFallback: QueuedRfidScan[] = [];

function hasIndexedDb(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function openQueueDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'idempotencyKey' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function createIdempotencyKey(warehouseCode: string): string {
  const randomSuffix =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${warehouseCode.toLowerCase()}-${Date.now()}-${randomSuffix}`;
}

export async function enqueueOfflineScan(scan: QueuedRfidScan): Promise<void> {
  if (!hasIndexedDb()) {
    if (!memoryFallback.some((item) => item.idempotencyKey === scan.idempotencyKey)) {
      memoryFallback.push(scan);
    }
    return;
  }

  const db = await openQueueDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(scan);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function listQueuedScans(): Promise<QueuedRfidScan[]> {
  if (!hasIndexedDb()) {
    return [...memoryFallback].sort(
      (a, b) => new Date(a.offlineTimestamp).getTime() - new Date(b.offlineTimestamp).getTime(),
    );
  }

  const db = await openQueueDb();
  const rows = await new Promise<QueuedRfidScan[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve((req.result as QueuedRfidScan[]) ?? []);
    req.onerror = () => reject(req.error);
  });
  db.close();

  return rows.sort(
    (a, b) => new Date(a.offlineTimestamp).getTime() - new Date(b.offlineTimestamp).getTime(),
  );
}

export async function clearQueuedScans(keys: string[]): Promise<void> {
  if (keys.length === 0) return;

  if (!hasIndexedDb()) {
    const keySet = new Set(keys);
    memoryFallback = memoryFallback.filter((item) => !keySet.has(item.idempotencyKey));
    return;
  }

  const db = await openQueueDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    keys.forEach((key) => store.delete(key));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function clearAllQueuedScans(): Promise<void> {
  if (!hasIndexedDb()) {
    memoryFallback = [];
    return;
  }

  const db = await openQueueDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
