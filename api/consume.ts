import type { VercelRequest, VercelResponse } from "@vercel/node"
import { getSessionToken, getSessionUser, isAuthorized } from "../lib/auth.js"
import { ensureSchema, getSql } from "../lib/db.js"

export default async function handler(req: VercelRequest, res: VercelResponse) {
	if (req.method !== "POST") {
		res.status(405).json({ error: "method_not_allowed" })
		return
	}

	if (!isAuthorized(req.headers.authorization)) {
		res.status(401).json({ error: "unauthorized" })
		return
	}

	const token = getSessionToken(req)
	if (!token) {
		res.status(401).json({ error: "no_session" })
		return
	}

	const body = (req.body ?? {}) as {
		reportId?: unknown
		cost?: unknown
		kind?: unknown
	}
	const reportId = typeof body.reportId === "string" ? body.reportId : ""
	const kind = body.kind === "checklist" ? "checklist" : "report"
	const parsedCost =
		typeof body.cost === "number" ? body.cost : Number(body.cost)
	const cost =
		Number.isFinite(parsedCost) && parsedCost > 0
			? Math.round(parsedCost * 100) / 100
			: 1

	if (!reportId) {
		res.status(400).json({ error: "reportId requerido" })
		return
	}

	try {
		await ensureSchema()
		const user = await getSessionUser(token)
		if (!user) {
			res.status(401).json({ error: "invalid_session" })
			return
		}

		const sql = getSql()
		const now = new Date().toISOString()
		const id =
			kind === "checklist"
				? `consume-checklist-${reportId}`
				: `consume-${reportId}`

		const balanceRow = await sql`
			SELECT credits FROM expo_user_credits WHERE user_id = ${user.id}
		`
		const currentCredits = Number(balanceRow[0]?.credits ?? 0)

		if (currentCredits < cost) {
			res.status(400).json({ error: "sin créditos suficientes" })
			return
		}

		const inserted = await sql`
			INSERT INTO expo_credit_history (
				id, user_id, type, credits, report_id, payment_id, created_at
			)
			VALUES (${id}, ${user.id}, 'consume', ${-cost}, ${reportId}, NULL, ${now})
			ON CONFLICT (id) DO NOTHING
			RETURNING id
		`

		if (inserted.length === 0) {
			const row = await sql`
				SELECT credits FROM expo_user_credits WHERE user_id = ${user.id}
			`
			res.status(200).json({
				credits: Number(row[0]?.credits ?? 0),
				alreadyConsumed: true,
			})
			return
		}

		const updated = await sql`
			UPDATE expo_user_credits
			SET credits = credits - ${cost}, updated_at = ${now}
			WHERE user_id = ${user.id}
			RETURNING credits
		`

		res.status(200).json({
			credits: Number(updated[0]?.credits ?? 0),
			alreadyConsumed: false,
		})
	} catch (e) {
		console.error("[consume] error:", e)
		res.status(500).json({ error: "no se pudo consumir el crédito" })
	}
}
