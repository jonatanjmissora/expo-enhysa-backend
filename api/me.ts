import type { VercelRequest, VercelResponse } from "@vercel/node"
import { getSessionToken, getSessionUser, isAuthorized } from "../lib/auth"
import { ensureSchema } from "../lib/db"

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
