import type { VercelRequest, VercelResponse } from "@vercel/node"
import { isAuthorized } from "../auth.js"
import { ensureSchema, getSql } from "../db.js"
import { sendPasswordResetEmail } from "../email.js"
import { generateResetToken, hashResetToken } from "../tokens.js"

const RESET_TTL_MINUTES = 10
const RATE_LIMIT_MAX = 3
const RATE_LIMIT_WINDOW_MINUTES = 15

export async function passwordForgotHandler(
	req: VercelRequest,
	res: VercelResponse
) {
	if (req.method !== "POST") {
		res.status(405).json({ error: "method_not_allowed" })
		return
	}
	if (!isAuthorized(req.headers.authorization)) {
		res.status(401).json({ error: "unauthorized" })
		return
	}

	const body = (req.body ?? {}) as { email?: unknown }
	const email = String(body.email ?? "")
		.trim()
		.toLowerCase()

	if (!email) {
		res.status(400).json({ error: "invalid_input" })
		return
	}

	try {
		await ensureSchema()
		const sql = getSql()

		const rows = await sql`
			SELECT id FROM expo_users WHERE email = ${email} LIMIT 1
		`
		const user = rows[0]

		// Responder siempre 200 para no revelar si el email existe.
		if (user) {
			const recent = await sql`
				SELECT COUNT(*)::int AS cnt
				FROM expo_password_reset_tokens
				WHERE user_id = ${user.id}
					AND created_at > now() - make_interval(mins => ${RATE_LIMIT_WINDOW_MINUTES})
			`
			const count = Number(recent[0]?.cnt ?? 0)

			if (count < RATE_LIMIT_MAX) {
				// Invalida los tokens previos (solo el más nuevo queda vigente).
				await sql`
					UPDATE expo_password_reset_tokens
					SET used_at = now()
					WHERE user_id = ${user.id} AND used_at IS NULL
				`

				const token = generateResetToken()
				const tokenHash = hashResetToken(token)

				await sql`
					INSERT INTO expo_password_reset_tokens (user_id, token_hash, expires_at)
					VALUES (
						${user.id},
						${tokenHash},
						now() + make_interval(mins => ${RESET_TTL_MINUTES})
					)
				`

				// Fire-and-forget: no bloquea la respuesta.
				void sendPasswordResetEmail(email, token).catch(error =>
					console.error("[password-forgot] email error:", error)
				)
			}
		}

		res.status(200).json({ ok: true })
	} catch (error) {
		console.error("[password-forgot] error:", error)
		res.status(500).json({ error: "server_error" })
	}
}
