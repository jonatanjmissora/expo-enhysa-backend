import type { VercelRequest } from "@vercel/node"
import { getWebSession } from "./web-auth.js"

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

export async function getSessionUser(
	token: string
): Promise<SessionUser | null> {
	const session = await getWebSession(token)
	if (!session) return null

	return {
		id: session.user.id,
		email: session.user.email,
		name: session.user.name,
		user_image: session.user.image,
	}
}
