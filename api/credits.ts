import type { VercelRequest, VercelResponse } from "@vercel/node"
import { isAuthorized } from "../lib/auth.js"
import { getSql } from "../lib/db.js"

export default async function handler(req: VercelRequest, res: VercelResponse) {
	if (req.method !== "GET") {
		res.status(405).json({ error: "method_not_allowed" })
		return
	}

	if (!isAuthorized(req.headers.authorization)) {
		res.status(401).json({ error: "unauthorized" })
		return
	}

	const userId = req.query?.userId
	if (!userId || typeof userId !== "string") {
		res.status(400).json({ error: "userId requerido" })
		return
	}

	try {
		const sql = getSql()
		const rows = await sql`
			SELECT credits FROM expo_user_credits WHERE user_id = ${userId}
		`
		const credits = (rows[0]?.credits as number | undefined) ?? 0

		res.status(200).json({ credits })
	} catch (e) {
		console.error("[credits] error:", e)
		res.status(500).json({ error: "no se pudo obtener el saldo" })
	}
}
