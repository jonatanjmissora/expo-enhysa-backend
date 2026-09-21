import type { VercelRequest, VercelResponse } from "@vercel/node"
import { createSession, isAuthorized } from "../lib/auth.js"
import { ensureSchema, getSql } from "../lib/db.js"
import { hashPassword } from "../lib/password.js"

export default async function handler(req: VercelRequest, res: VercelResponse) {
	if (req.method !== "POST") {
		res.status(405).json({ error: "method_not_allowed" })
		return
	}
	if (!isAuthorized(req.headers.authorization)) {
		res.status(401).json({ error: "unauthorized" })
		return
	}

	const body = (req.body ?? {}) as {
		email?: unknown
		password?: unknown
		name?: unknown
	}
	const email = String(body.email ?? "")
		.trim()
		.toLowerCase()
	const password = String(body.password ?? "")
	const name =
		typeof body.name === "string" && body.name.trim() ? body.name.trim() : null

	if (!email || !password || password.length < 6) {
		res.status(400).json({ error: "invalid_input" })
		return
	}

	try {
		await ensureSchema()
		const sql = getSql()

		const existing = await sql`
			SELECT id FROM expo_users WHERE email = ${email} LIMIT 1
		`
		if (existing.length > 0) {
			res.status(409).json({ error: "email_exists" })
			return
		}

		const passwordHash = await hashPassword(password)
		const rows = await sql`
			INSERT INTO expo_users (email, password_hash, name)
			VALUES (${email}, ${passwordHash}, ${name})
			RETURNING id, email, name, user_image
		`
		const user = rows[0]
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
		console.error("[register] error:", error)
		res.status(500).json({ error: "server_error" })
	}
}
