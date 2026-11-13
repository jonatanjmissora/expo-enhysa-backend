import type { VercelRequest, VercelResponse } from "@vercel/node"
import { getSessionToken, isAuthorized } from "../auth.js"
import { getSql } from "../db.js"
import { getWebSession } from "../web-auth.js"

export async function meHandler(req: VercelRequest, res: VercelResponse) {
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
		const session = await getWebSession(token)
		if (!session) {
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
				WHERE id = ${session.user.id}::uuid
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
				id: session.user.id,
				email: session.user.email,
				name: session.user.name,
				userImage: session.user.image,
			},
		})
	} catch (error) {
		console.error("[me] error:", error)
		res.status(500).json({ error: "server_error" })
	}
}
