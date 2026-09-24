import type { VercelRequest, VercelResponse } from "@vercel/node"
import { getSessionToken, getSessionUser, isAuthorized } from "../lib/auth.js"
import { ensureSchema, getSql } from "../lib/db.js"

export default async function handler(req: VercelRequest, res: VercelResponse) {
	if (!isAuthorized(req.headers.authorization)) {
		res.status(401).json({ error: "unauthorized" })
		return
	}

	const token = getSessionToken(req)
	if (!token) {
		res.status(401).json({ error: "no_session" })
		return
	}

	try {
		await ensureSchema()
		const user = await getSessionUser(token)
		if (!user) {
			res.status(401).json({ error: "invalid_session" })
			return
		}

		if (req.method === "PATCH") {
			const body = (req.body ?? {}) as { name?: unknown; userImage?: unknown }
			const name = typeof body.name === "string" ? body.name.trim() : null
			const userImage =
				typeof body.userImage === "string" ? body.userImage : null

			const sql = getSql()
			const rows = await sql`
				UPDATE expo_users
				SET name = ${name}, user_image = ${userImage}, updated_at = now()
				WHERE id = ${user.id}
				RETURNING id, email, name, user_image
			`
			const updated = rows[0]

			res.status(200).json({
				user: {
					id: updated.id,
					email: updated.email,
					name: updated.name,
					userImage: updated.user_image,
				},
			})
			return
		}

		res.status(200).json({
			user: {
				id: user.id,
				email: user.email,
				name: user.name,
				userImage: user.user_image,
			},
		})
	} catch (error) {
		console.error("[me] error:", error)
		res.status(500).json({ error: "server_error" })
	}
}
