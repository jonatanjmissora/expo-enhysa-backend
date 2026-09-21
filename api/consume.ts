import type { VercelRequest, VercelResponse } from "@vercel/node"
import { isAuthorized } from "../lib/auth.js"
import { getSql } from "../lib/db.js"

export default async function handler(req: VercelRequest, res: VercelResponse) {
	if (req.method !== "POST") {
		res.status(405).json({ error: "method_not_allowed" })
		return
	}

	if (!isAuthorized(req.headers.authorization)) {
		res.status(401).json({ error: "unauthorized" })
		return
	}

	const body = (req.body ?? {}) as { userId?: string; reportId?: string }
	const { userId, reportId } = body

	if (!userId || !reportId) {
		res.status(400).json({ error: "userId y reportId son requeridos" })
		return
	}

	try {
		const sql = getSql()
		const now = new Date().toISOString()
		const id = `consume-${reportId}`

		const balanceRow = await sql`
			SELECT credits FROM expo_user_credits WHERE user_id = ${userId}
		`
		const currentCredits = (balanceRow[0]?.credits as number | undefined) ?? 0

		if (currentCredits < 1) {
			res.status(400).json({ error: "sin créditos suficientes" })
			return
		}

		const inserted = await sql`
			INSERT INTO expo_credit_history (
				id, user_id, type, credits, report_id, payment_id, created_at
			)
			VALUES (${id}, ${userId}, 'consume', -1, ${reportId}, NULL, ${now})
			ON CONFLICT (id) DO NOTHING
			RETURNING id
		`

		if (inserted.length === 0) {
			const row = await sql`
				SELECT credits FROM expo_user_credits WHERE user_id = ${userId}
			`
			res.status(200).json({
				credits: (row[0]?.credits as number | undefined) ?? 0,
				alreadyConsumed: true,
			})
			return
		}

		const updated = await sql`
			UPDATE expo_user_credits
			SET credits = credits - 1, updated_at = ${now}
			WHERE user_id = ${userId}
			RETURNING credits
		`

		res.status(200).json({
			credits: (updated[0]?.credits as number | undefined) ?? 0,
			alreadyConsumed: false,
		})
	} catch (e) {
		console.error("[consume] error:", e)
		res.status(500).json({ error: "no se pudo consumir el crédito" })
	}
}
