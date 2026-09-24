import type { VercelRequest, VercelResponse } from "@vercel/node"
import { getSessionToken, getSessionUser, isAuthorized } from "../lib/auth.js"
import { ensureSchema, getSql } from "../lib/db.js"
import { getPlan } from "../lib/plans.js"
import { createPreference, isSandbox } from "../lib/mp.js"
import { randomUUID } from "node:crypto"

type PreferenceInput = {
	planId?: string
}

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

	const body = (req.body ?? {}) as PreferenceInput
	const planId = typeof body.planId === "string" ? body.planId : ""

	if (!planId) {
		res.status(400).json({ error: "planId requerido" })
		return
	}

	const plan = getPlan(planId)
	if (!plan) {
		res.status(400).json({ error: "plan inválido" })
		return
	}

	const backUrl = process.env.APP_DEEP_LINK
	const notificationUrl = `${process.env.BACKEND_BASE_URL}/webhook`

	try {
		await ensureSchema()
		const user = await getSessionUser(token)
		if (!user) {
			res.status(401).json({ error: "invalid_session" })
			return
		}

		const checkoutId = randomUUID()
		const preference = await createPreference({
			items: [
				{
					id: plan.id,
					title: plan.title,
					quantity: 1,
					currency_id: "ARS",
					unit_price: plan.price,
				},
			],
			external_reference: user.id,
			notification_url: notificationUrl,
			back_urls: {
				success: `${backUrl}?result=success`,
				failure: `${backUrl}?result=failure`,
				pending: `${backUrl}?result=pending`,
			},
			auto_return: "approved",
			metadata: { plan_id: plan.id, checkout_id: checkoutId },
		})

		const sql = getSql()
		await sql`
			INSERT INTO expo_pending_payments (
				preference_id, checkout_id, user_id, plan_id, status, created_at, updated_at
			)
			VALUES (${preference.id}, ${checkoutId}, ${user.id}, ${plan.id}, 'pending', ${now()}, ${now()})
		`

		const initPoint = isSandbox()
			? preference.sandbox_init_point
			: preference.init_point

		res.status(200).json({
			init_point: initPoint,
			preferenceId: preference.id,
		})
	} catch (e) {
		console.error("[preference] error:", e)
		res.status(500).json({ error: "no se pudo crear la preferencia" })
	}
}

function now(): string {
	return new Date().toISOString()
}
