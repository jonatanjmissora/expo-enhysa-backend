-- EnHySa backend — schema Neon (Fase 1)
-- Ejecutar en Neon Console (SQL Editor) o vía psql.

-- 1. Saldo de créditos por usuario (caché del ledger)
CREATE TABLE IF NOT EXISTS expo_user_credits (
	user_id TEXT PRIMARY KEY,
	credits INTEGER NOT NULL DEFAULT 0,
	updated_at TEXT NOT NULL
);

-- 2. Ledger append-only de movimientos (nunca se edita, solo se agrega)
CREATE TABLE IF NOT EXISTS expo_credit_history (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL,
	type TEXT NOT NULL,          -- 'purchase' | 'consume' | 'bonus' | 'refund'
	credits INTEGER NOT NULL,     -- +N compra, -1 consumo
	report_id TEXT,               -- si es consumo
	payment_id TEXT,              -- si es compra
	created_at TEXT NOT NULL
);

-- 3. Pagos pendientes (una fila por preferencia de Checkout Pro)
CREATE TABLE IF NOT EXISTS expo_pending_payments (
	preference_id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL,
	plan_id TEXT NOT NULL,
	mp_payment_id TEXT,
	status TEXT NOT NULL,         -- 'pending' | 'approved' | 'rejected'
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_expo_credit_history_user
	ON expo_credit_history (user_id);

CREATE INDEX IF NOT EXISTS idx_expo_pending_payments_user_status
	ON expo_pending_payments (user_id, status);
