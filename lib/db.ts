import { neon } from "@neondatabase/serverless"

export function getSql() {
	const url = process.env.DATABASE_URL
	if (!url) throw new Error("DATABASE_URL no configurada")
	return neon(url)
}

let schemaPromise: Promise<void> | null = null

/**
 * Crea (idempotente) las tablas de identidad en Neon.
 * `expo_users` es el ancla: mapea email -> userId canónico.
 * `expo_sessions` guarda un token opaco por sesión (revocable).
 */
export function ensureSchema(): Promise<void> {
	if (!schemaPromise) {
		schemaPromise = (async () => {
			const sql = getSql()
			await sql`
				CREATE TABLE IF NOT EXISTS expo_users (
					id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
					email TEXT NOT NULL UNIQUE,
					password_hash TEXT NOT NULL,
					name TEXT,
					user_image TEXT,
					created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
					updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
				)
			`
			await sql`
				CREATE TABLE IF NOT EXISTS expo_sessions (
					token TEXT PRIMARY KEY,
					user_id UUID NOT NULL REFERENCES expo_users(id) ON DELETE CASCADE,
					created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
					expires_at TIMESTAMPTZ NOT NULL
				)
			`
		})().catch(error => {
			schemaPromise = null
			throw error
		})
	}

	return schemaPromise
}
