import type { VercelRequest, VercelResponse } from "@vercel/node"
import { isAuthorized } from "../lib/auth.js"
import { getSql } from "../lib/db.js"
import { getPlan } from "../lib/plans.js"
import { createPreference, isSandbox } from "../lib/mp.js"

type PreferenceInput = {
	planId?: string
	userId?: string
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

	const body = (req.body ?? {}) as PreferenceInput
	const { planId, userId } = body

	if (!planId || !userId) {
		res.status(400).json({ error: "planId y userId son requeridos" })
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
			external_reference: userId,
			notification_url: notificationUrl,
			back_urls: {
				success: `${backUrl}?result=success`,
				failure: `${backUrl}?result=failure`,
				pending: `${backUrl}?result=pending`,
			},
			auto_return: "approved",
			metadata: { plan_id: plan.id },
		})

		const sql = getSql()
		await sql`
			INSERT INTO expo_pending_payments (
				preference_id, user_id, plan_id, status, created_at, updated_at
			)
			VALUES (${preference.id}, ${userId}, ${plan.id}, 'pending', ${now()}, ${now()})
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
