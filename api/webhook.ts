import type { VercelRequest, VercelResponse } from "@vercel/node"
import {
	WebhookSignatureValidator,
	InvalidWebhookSignatureError,
} from "mercadopago"
import { getSql } from "../lib/db.js"
import { getPaymentById } from "../lib/mp.js"
import { getPlan } from "../lib/plans.js"

type WebhookBody = {
	type?: string
	action?: string
	data?: { id?: string | number }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
	if (req.method !== "POST") {
		res.status(405).json({ error: "method_not_allowed" })
		return
	}

	const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET
	if (!secret) {
		res.status(500).json({ error: "webhook secret no configurado" })
		return
	}

	const body = (req.body ?? {}) as WebhookBody
	const xSignature = req.headers["x-signature"]
	const xRequestId = req.headers["x-request-id"]

	const rawDataId = body.data?.id ?? req.query?.["data.id"]
	const dataId =
		rawDataId == null
			? undefined
			: Array.isArray(rawDataId)
				? rawDataId[0]
				: String(rawDataId)

	try {
		WebhookSignatureValidator.validate({
			xSignature,
			xRequestId,
			dataId,
			secret,
			toleranceSeconds: 300,
		})
	} catch (e) {
		if (e instanceof InvalidWebhookSignatureError) {
			console.error("[webhook] firma inválida:", e.reason, e.requestId)
			res.status(401).json({ error: "signature inválida" })
			return
		}
		throw e
	}

	if (body.type !== "payment" || !dataId) {
		res.status(200).json({ ok: true })
		return
	}

	try {
		await processPayment(dataId)
	} catch (e) {
		console.error("[webhook] error procesando pago:", e)
		res.status(500).json({ error: "error procesando pago" })
		return
	}

	res.status(200).json({ ok: true })
}

async function processPayment(paymentId: string) {
	const payment = await getPaymentById(paymentId)
	const userId = payment.external_reference
	if (!userId) return

	const sql = getSql()
	const timestamp = new Date().toISOString()

	if (payment.status === "approved") {
		const planId =
			payment.metadata?.plan_id ??
			(await resolvePlanId(sql, userId))

		if (!planId) {
			console.error("[webhook] no se pudo resolver el plan del pago", paymentId)
			return
		}

		const plan = getPlan(planId)
		if (!plan) return

		const historyId = `purchase-${paymentId}`

		const inserted = await sql`
			INSERT INTO expo_credit_history (
				id, user_id, type, credits, report_id, payment_id, created_at
			)
			VALUES (${historyId}, ${userId}, 'purchase', ${plan.credits}, NULL, ${paymentId}, ${timestamp})
			ON CONFLICT (id) DO NOTHING
			RETURNING id
		`

		if (inserted.length === 0) {
			return
		}

		await sql`
			INSERT INTO expo_user_credits (user_id, credits, updated_at)
			VALUES (${userId}, ${plan.credits}, ${timestamp})
			ON CONFLICT (user_id)
			DO UPDATE SET
				credits = expo_user_credits.credits + EXCLUDED.credits,
				updated_at = EXCLUDED.updated_at
		`

		await sql`
			UPDATE expo_pending_payments
			SET mp_payment_id = ${paymentId}, status = 'approved', updated_at = ${timestamp}
			WHERE user_id = ${userId} AND status = 'pending'
		`
		return
	}

	await sql`
		UPDATE expo_pending_payments
		SET mp_payment_id = ${paymentId}, status = ${payment.status ?? "pending"}, updated_at = ${timestamp}
		WHERE user_id = ${userId} AND status = 'pending'
	`
}

async function resolvePlanId(
	sql: ReturnType<typeof getSql>,
	userId: string
): Promise<string | null> {
	const rows = await sql`
		SELECT plan_id
		FROM expo_pending_payments
		WHERE user_id = ${userId} AND status = 'pending'
		ORDER BY created_at DESC
		LIMIT 1
	`
	return (rows[0]?.plan_id as string | undefined) ?? null
}
