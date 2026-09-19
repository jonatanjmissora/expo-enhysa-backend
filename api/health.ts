import type { VercelRequest, VercelResponse } from "@vercel/node"
import { isAuthorized } from "../lib/auth.js"
import { getSql } from "../lib/db.js"

export default async function handler(req: VercelRequest, res: VercelResponse) {
	if (!isAuthorized(req.headers.authorization)) {
		res.status(401).json({ error: "unauthorized" })
		return
	}

	let db = false
	try {
		const sql = getSql()
		await sql`SELECT 1`
		db = true
	} catch (e) {
		console.error("[health] DB error:", e)
		db = false
	}

	res.status(200).json({ ok: true, db })
}
