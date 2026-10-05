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
	checkout_id TEXT UNIQUE,
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

-- 4. Técnicos (backup/sync local-first). `id` = UUID local → idempotencia.
CREATE TABLE IF NOT EXISTS expo_tecnicos (
	id             TEXT PRIMARY KEY,
	user_id        UUID NOT NULL,
	nombre         TEXT,
	telefono       TEXT,
	localidad      TEXT,
	cargo          TEXT,
	matricula      TEXT,
	matricula_img  TEXT,
	firma_img      TEXT,
	empresa_logo   TEXT,
	dni            INTEGER,
	deleted_at     TIMESTAMPTZ,
	updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expo_tecnicos_user
	ON expo_tecnicos (user_id);

-- 5. Empresas (backup/sync local-first).
CREATE TABLE IF NOT EXISTS expo_empresas (
	id             TEXT PRIMARY KEY,
	user_id        UUID NOT NULL,
	cuit           TEXT,
	razon_social   TEXT,
	direccion      TEXT,
	localidad      TEXT,
	provincia      TEXT,
	codigo_postal  TEXT,
	horarios       TEXT,
	logo           TEXT,
	deleted_at     TIMESTAMPTZ,
	updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expo_empresas_user
	ON expo_empresas (user_id);

-- 6. Instrumentos (backup/sync local-first).
CREATE TABLE IF NOT EXISTS expo_instrumentos (
	id                    TEXT PRIMARY KEY,
	user_id               UUID NOT NULL,
	nombre                TEXT,
	marca                 TEXT,
	modelo                TEXT,
	serie                 TEXT,
	fecha_calibracion     TEXT,
	imagenes_calibracion  TEXT,
	imagenes              TEXT,
	deleted_at            TIMESTAMPTZ,
	updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expo_instrumentos_user
	ON expo_instrumentos (user_id);

-- 7. Imágenes (metadata de archivos en UploadThing; el binario NO vive en Neon).
CREATE TABLE IF NOT EXISTS expo_images (
	id          TEXT PRIMARY KEY,          -- = imageId (UUID local)
	user_id     UUID NOT NULL,
	filename    TEXT,
	mime_type   TEXT,
	width       INTEGER,
	height      INTEGER,
	size        INTEGER,
	remote_key  TEXT,                      -- fileKey de UploadThing
	remote_url  TEXT,                      -- ufsUrl
	deleted_at  TIMESTAMPTZ,
	updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expo_images_user
	ON expo_images (user_id);

-- 8. Informes de iluminación
CREATE TABLE IF NOT EXISTS expo_informes_iluminacion (
	id                     TEXT PRIMARY KEY,
	user_id                UUID NOT NULL,
	title                  TEXT,
	empresa_id             TEXT,
	instrumento_id         TEXT,
	tecnico_id             TEXT,
	estado                 TEXT,
	humedad                TEXT,
	temperatura            TEXT,
	tecnico_snapshot       TEXT,
	empresa_snapshot       TEXT,
	instrumento_snapshot   TEXT,
	created_at             TIMESTAMPTZ,
	observacion            TEXT,
	conclusion             TEXT,
	recomendacion          TEXT,
	finished_at            TEXT,
	credit_consumed        INTEGER,
	credit_consumed_at     TEXT,
	deleted_at             TIMESTAMPTZ,
	updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expo_informes_user
	ON expo_informes_iluminacion (user_id);

-- 9. Áreas de iluminación
CREATE TABLE IF NOT EXISTS expo_areas_iluminacion (
	id                   TEXT PRIMARY KEY,
	user_id              UUID NOT NULL,
	report_id            TEXT,
	nombre               TEXT,
	tipo                 TEXT,
	iluminacion_tipo     TEXT,
	iluminacion_fuente   TEXT,
	iluminacion          TEXT,
	valor_requerido      TEXT,
	observaciones        TEXT,
	largo                REAL,
	ancho                REAL,
	alto                 REAL,
	imagenes             TEXT,
	puntos               TEXT,
	timestamps           TEXT,
	deleted_at           TIMESTAMPTZ,
	updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expo_areas_user
	ON expo_areas_iluminacion (user_id);

-- 10. Localizadas de iluminación
CREATE TABLE IF NOT EXISTS expo_localizadas_iluminacion (
	id                   TEXT PRIMARY KEY,
	user_id              UUID NOT NULL,
	report_id            TEXT,
	nombre               TEXT,
	tipo                 TEXT,
	iluminacion_tipo     TEXT,
	iluminacion_fuente   TEXT,
	iluminacion          TEXT,
	valor_requerido      TEXT,
	observaciones        TEXT,
	imagenes             TEXT,
	valor                INTEGER,
	timestamps           TEXT,
	deleted_at           TIMESTAMPTZ,
	updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expo_localizadas_user
	ON expo_localizadas_iluminacion (user_id);
