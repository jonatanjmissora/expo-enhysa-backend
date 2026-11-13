import { neon } from "@neondatabase/serverless"

export function getSql() {
	const url = process.env.DATABASE_URL
	if (!url) throw new Error("DATABASE_URL no configurada")
	return neon(url)
}

let schemaPromise: Promise<void> | null = null

/**
 * Crea (idempotente) las tablas de créditos en Neon.
 * La identidad la maneja Better Auth con las tablas `expo_users`,
 * `expo_accounts`, `expo_sessions` y `expo_verifications`.
 */
export function ensureSchema(): Promise<void> {
	if (!schemaPromise) {
		schemaPromise = (async () => {
			const sql = getSql()
			await sql`
				CREATE TABLE IF NOT EXISTS expo_user_credits (
					user_id UUID PRIMARY KEY,
					credits NUMERIC(10, 2) NOT NULL DEFAULT 0,
					updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
				)
			`
			await sql`
				CREATE TABLE IF NOT EXISTS expo_credit_history (
					id TEXT PRIMARY KEY,
					user_id UUID NOT NULL,
					type TEXT NOT NULL,
					credits NUMERIC(10, 2) NOT NULL,
					report_id TEXT,
					payment_id TEXT,
					created_at TIMESTAMPTZ NOT NULL DEFAULT now()
				)
			`
			await sql`
				DO $$
				BEGIN
					IF EXISTS (
						SELECT 1 FROM information_schema.columns
						WHERE table_name = 'expo_user_credits'
							AND column_name = 'credits'
							AND data_type IN ('integer', 'bigint', 'smallint')
					) THEN
						ALTER TABLE expo_user_credits
						ALTER COLUMN credits TYPE NUMERIC(10, 2) USING credits::numeric;
					END IF;
					IF EXISTS (
						SELECT 1 FROM information_schema.columns
						WHERE table_name = 'expo_credit_history'
							AND column_name = 'credits'
							AND data_type IN ('integer', 'bigint', 'smallint')
					) THEN
						ALTER TABLE expo_credit_history
						ALTER COLUMN credits TYPE NUMERIC(10, 2) USING credits::numeric;
					END IF;
				END $$;
			`
		})().catch(error => {
			schemaPromise = null
			throw error
		})
	}

	return schemaPromise
}
