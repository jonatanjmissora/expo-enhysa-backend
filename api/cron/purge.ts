import type { VercelRequest, VercelResponse } from "@vercel/node"
import { isAuthorized } from "../../lib/auth.js"
import { ensureSchema, getSql } from "../../lib/db.js"

/** Retención de tombstones: pasado este plazo no queda dispositivo que los use. */
const RETENTION_DAYS = 30

/**
 * Autoriza el cron de Vercel (`Authorization: Bearer <CRON_SECRET>`) o, para
 * pruebas manuales, el `API_TOKEN` de la app.
 */
function isCronAuthorized(authorization?: string): boolean {
	const secret = process.env.CRON_SECRET
	if (secret && authorization === `Bearer ${secret}`) return true
	return isAuthorized(authorization)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
	if (!isCronAuthorized(req.headers.authorization)) {
		res.status(401).json({ error: "unauthorized" })
		return
	}

	try {
		await ensureSchema()
		const sql = getSql()

		// Purga dura de tombstones viejos (no los necesita nadie).
		const purged = await sql`
			DELETE FROM expo_tecnicos
			WHERE deleted_at IS NOT NULL
			  AND deleted_at < now() - make_interval(days => ${RETENTION_DAYS})
			RETURNING id
		`

		res.status(200).json({ ok: true, purged: purged.length })
	} catch (e) {
		console.error("[cron/purge] error:", e)
		res.status(500).json({ error: "no se pudo purgar" })
	}
}
