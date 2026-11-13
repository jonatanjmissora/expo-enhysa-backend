import type { VercelRequest, VercelResponse } from "@vercel/node"
import { getSessionToken, isAuthorized } from "../auth.js"
import { webAuthFetch } from "../web-auth.js"

export async function logoutHandler(req: VercelRequest, res: VercelResponse) {
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
		res.status(200).json({ ok: true })
		return
	}

	try {
		await webAuthFetch("/api/auth/sign-out", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
			},
		})
		res.status(200).json({ ok: true })
	} catch (error) {
		console.error("[logout] error:", error)
		res.status(500).json({ error: "server_error" })
	}
}
