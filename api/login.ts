import type { VercelRequest, VercelResponse } from "@vercel/node"
import { createSession, isAuthorized } from "../lib/auth.js"
import { ensureSchema, getSql } from "../lib/db.js"
import { verifyPassword } from "../lib/password.js"

export default async function handler(req: VercelRequest, res: VercelResponse) {
	if (req.method !== "POST") {
		res.status(405).json({ error: "method_not_allowed" })
		return
	}
	if (!isAuthorized(req.headers.authorization)) {
		res.status(401).json({ error: "unauthorized" })
		return
	}

	const body = (req.body ?? {}) as { email?: unknown; password?: unknown }
	const email = String(body.email ?? "")
		.trim()
		.toLowerCase()
	const password = String(body.password ?? "")

	if (!email || !password) {
		res.status(400).json({ error: "invalid_input" })
		return
	}

	try {
		await ensureSchema()
		const sql = getSql()

		const rows = await sql`
			SELECT id, email, name, user_image, password_hash
			FROM expo_users
			WHERE email = ${email}
			LIMIT 1
		`
		const user = rows[0]
		if (!user) {
			res.status(404).json({ error: "email_not_found" })
			return
		}

		const valid = await verifyPassword(password, user.password_hash)
		if (!valid) {
			res.status(401).json({ error: "invalid_password" })
			return
		}

		const token = await createSession(user.id)

		res.status(200).json({
			token,
			user: {
				id: user.id,
				email: user.email,
				name: user.name,
				userImage: user.user_image,
			},
		})
	} catch (error) {
		console.error("[login] error:", error)
		res.status(500).json({ error: "server_error" })
	}
}
