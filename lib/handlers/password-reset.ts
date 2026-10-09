import type { VercelRequest, VercelResponse } from "@vercel/node"
import { isAuthorized } from "../auth.js"
import { ensureSchema, getSql } from "../db.js"
import { hashPassword } from "../password.js"
import { hashResetToken } from "../tokens.js"

export async function passwordResetHandler(
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

	const body = (req.body ?? {}) as { token?: unknown; newPassword?: unknown }
	const token = String(body.token ?? "").trim()
	const newPassword = String(body.newPassword ?? "")

	if (!token || newPassword.length < 6) {
		res.status(400).json({ error: "invalid_input" })
		return
	}

	try {
		await ensureSchema()
		const sql = getSql()

		const tokenHash = hashResetToken(token)
		const rows = await sql`
			SELECT t.id, t.user_id, u.email
			FROM expo_password_reset_tokens t
			JOIN expo_users u ON u.id = t.user_id
			WHERE t.token_hash = ${tokenHash}
				AND t.used_at IS NULL
				AND t.expires_at > now()
			LIMIT 1
		`
		const row = rows[0]
		if (!row) {
			res.status(400).json({ error: "invalid_token" })
			return
		}

		const passwordHash = await hashPassword(newPassword)

		// Atómico: cambia la contraseña, quema el token y cierra sesiones.
		await sql.transaction(txn => [
			txn`
				UPDATE expo_users
				SET password_hash = ${passwordHash}, updated_at = now()
				WHERE id = ${row.user_id}
			`,
			txn`
				UPDATE expo_password_reset_tokens
				SET used_at = now()
				WHERE id = ${row.id}
			`,
			txn`DELETE FROM expo_sessions WHERE user_id = ${row.user_id}`,
		])

		res.status(200).json({ email: row.email })
	} catch (error) {
		console.error("[password-reset] error:", error)
		res.status(500).json({ error: "server_error" })
	}
}
