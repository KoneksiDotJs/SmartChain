-- SmartChain: Integrated Supply Chain Intelligence
-- PostgreSQL DDL Schema (PT Nusantara Manufacturing)

CREATE TYPE "UserRole" AS ENUM ('DIREKSI', 'PROCUREMENT_MANAGER', 'WAREHOUSE_OPERATOR', 'LOGISTICS_MANAGER', 'PARTNER', 'SYSTEM_ADMIN');
CREATE TYPE "SupplierTier" AS ENUM ('MAIN', 'BACKUP');
CREATE TYPE "SupplierStatus" AS ENUM ('ACTIVE', 'HALTED', 'STANDBY');
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT_RFQ', 'PENDING_APPROVAL', 'APPROVED', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED');
CREATE TYPE "NetworkStatus" AS ENUM ('ONLINE', 'OFFLINE');
CREATE TYPE "SyncDirection" AS ENUM ('IN', 'OUT', 'CYCLE_COUNT');
CREATE TYPE "SlaTier" AS ENUM ('TIER_1', 'TIER_2', 'TIER_3');
CREATE TYPE "AllocationStatus" AS ENUM ('PENDING', 'APPROVED_SLA', 'HELD_ANOMALY', 'PARTIAL_ALLOCATED', 'DISPATCHED');
CREATE TYPE "TrackingStatus" AS ENUM ('PLANNED', 'CONSOLIDATED', 'IN_TRANSIT', 'DELIVERED');

CREATE TABLE user_accounts (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role "UserRole" NOT NULL,
  entity_code TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE factories (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  daily_capacity INTEGER NOT NULL,
  operational_state TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE material_products (
  id TEXT PRIMARY KEY,
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  unit TEXT NOT NULL,
  unit_cost INTEGER NOT NULL,
  daily_demand_avg DOUBLE PRECISION NOT NULL,
  demand_std_dev DOUBLE PRECISION NOT NULL,
  lead_time_days INTEGER NOT NULL,
  safety_stock INTEGER NOT NULL,
  reorder_point INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE suppliers (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  tier_type "SupplierTier" NOT NULL,
  sla_score DOUBLE PRECISION NOT NULL,
  lead_time_days INTEGER NOT NULL,
  status "SupplierStatus" NOT NULL DEFAULT 'ACTIVE',
  halted_days INTEGER NOT NULL DEFAULT 0,
  halted_at TIMESTAMPTZ,
  material_category TEXT NOT NULL,
  city TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE purchase_orders (
  id TEXT PRIMARY KEY,
  po_number TEXT UNIQUE NOT NULL,
  supplier_id TEXT NOT NULL REFERENCES suppliers(id),
  material_id TEXT NOT NULL REFERENCES material_products(id),
  factory_id TEXT NOT NULL REFERENCES factories(id),
  quantity INTEGER NOT NULL,
  is_rfq_fallback BOOLEAN NOT NULL DEFAULT FALSE,
  triggered_by_rop BOOLEAN NOT NULL DEFAULT FALSE,
  status "PurchaseOrderStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
  expected_date TIMESTAMPTZ NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE warehouses (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  region TEXT NOT NULL,
  network_status "NetworkStatus" NOT NULL DEFAULT 'ONLINE',
  offline_hours INTEGER NOT NULL DEFAULT 0,
  last_sync_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE inventory_stocks (
  id TEXT PRIMARY KEY,
  warehouse_id TEXT NOT NULL REFERENCES warehouses(id),
  material_id TEXT NOT NULL REFERENCES material_products(id),
  rfid_qty INTEGER NOT NULL,
  physical_qty INTEGER NOT NULL,
  quarantine_qty INTEGER NOT NULL DEFAULT 0,
  rop INTEGER NOT NULL,
  safety_stock INTEGER NOT NULL,
  last_counted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (warehouse_id, material_id)
);

CREATE TABLE rfid_sync_logs (
  id TEXT PRIMARY KEY,
  stock_id TEXT NOT NULL REFERENCES inventory_stocks(id),
  warehouse_id TEXT NOT NULL REFERENCES warehouses(id),
  idempotency_key TEXT UNIQUE NOT NULL,
  delta_qty INTEGER NOT NULL,
  direction "SyncDirection" NOT NULL,
  offline_timestamp TIMESTAMPTZ NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  was_offline BOOLEAN NOT NULL DEFAULT FALSE,
  operator_id TEXT NOT NULL
);

CREATE TABLE distributors (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  route_group TEXT NOT NULL,
  sla_tier "SlaTier" NOT NULL,
  sla_score DOUBLE PRECISION NOT NULL,
  monthly_quota INTEGER NOT NULL,
  credit_limit INTEGER NOT NULL,
  used_credit INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sales_orders (
  id TEXT PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,
  distributor_id TEXT NOT NULL REFERENCES distributors(id),
  material_id TEXT NOT NULL REFERENCES material_products(id),
  requested_qty INTEGER NOT NULL,
  allocated_qty INTEGER NOT NULL DEFAULT 0,
  unit_price INTEGER NOT NULL,
  total_amount INTEGER NOT NULL,
  anomaly_flag BOOLEAN NOT NULL DEFAULT FALSE,
  anomaly_reason TEXT,
  sla_priority INTEGER NOT NULL DEFAULT 50,
  allocation_status "AllocationStatus" NOT NULL DEFAULT 'PENDING',
  deposit_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE shipments (
  id TEXT PRIMARY KEY,
  shipment_number TEXT UNIQUE NOT NULL,
  order_id TEXT NOT NULL REFERENCES sales_orders(id),
  warehouse_id TEXT NOT NULL REFERENCES warehouses(id),
  route_group TEXT NOT NULL,
  carrier_name TEXT NOT NULL,
  base_cost INTEGER NOT NULL,
  consolidated_cost INTEGER NOT NULL,
  is_consolidated BOOLEAN NOT NULL DEFAULT FALSE,
  consolidation_batch_id TEXT,
  tracking_status "TrackingStatus" NOT NULL DEFAULT 'PLANNED',
  estimated_arrival TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE demand_history (
  id TEXT PRIMARY KEY,
  material_id TEXT NOT NULL REFERENCES material_products(id),
  period_label TEXT NOT NULL,
  period_index INTEGER NOT NULL,
  observed_qty INTEGER,
  is_missing BOOLEAN NOT NULL DEFAULT FALSE,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (material_id, period_index)
);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  previous_state JSONB,
  new_state JSONB NOT NULL,
  reason TEXT,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- NFR-02: Enforce append-only immutability on audit_logs at the PostgreSQL level
CREATE OR REPLACE FUNCTION forbid_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is immutable: % operations are forbidden', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_logs_no_update
  BEFORE UPDATE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION forbid_audit_log_mutation();

CREATE TRIGGER trg_audit_logs_no_delete
  BEFORE DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION forbid_audit_log_mutation();
