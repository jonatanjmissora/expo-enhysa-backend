import { randomBytes } from "node:crypto"
import type { VercelRequest } from "@vercel/node"
import { getSql } from "./db.js"

const SESSION_DAYS = 30

export type SessionUser = {
	id: string
	email: string
	name: string | null
	user_image: string | null
}

/** Gate de la app (token global compartido). No es auth por usuario. */
export function isAuthorized(authHeader?: string): boolean {
	const token = authHeader?.replace(/^Bearer\s+/i, "")
	const expected = process.env.API_TOKEN
	if (!expected) return false
	return !!token && token === expected
}

export function getSessionToken(req: VercelRequest): string | null {
	const header = req.headers["x-session-token"]
	const token = Array.isArray(header) ? header[0] : header
	return token?.trim() || null
}

export async function createSession(userId: string): Promise<string> {
	const sql = getSql()
	const token = randomBytes(32).toString("hex")
	const expiresAt = new Date(
		Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000
	).toISOString()

	await sql`
		INSERT INTO expo_sessions (token, user_id, expires_at)
		VALUES (${token}, ${userId}, ${expiresAt})
	`

	return token
}

export async function getSessionUser(
	token: string
): Promise<SessionUser | null> {
	const sql = getSql()
	const rows = await sql`
		SELECT u.id, u.email, u.name, u.user_image
		FROM expo_sessions s
		JOIN expo_users u ON u.id = s.user_id
		WHERE s.token = ${token} AND s.expires_at > now()
		LIMIT 1
	`
	return (rows[0] as SessionUser | undefined) ?? null
}

export async function deleteSession(token: string): Promise<void> {
	const sql = getSql()
	await sql`DELETE FROM expo_sessions WHERE token = ${token}`
}
