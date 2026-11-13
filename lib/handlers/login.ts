import type { VercelRequest, VercelResponse } from "@vercel/node"
import { isAuthorized } from "../auth.js"
import { getSql } from "../db.js"
import { webAuthFetch, type WebAuthUser } from "../web-auth.js"

const DEMO_DOMAIN = "@enhysa.demo"

function mapUser(user: WebAuthUser) {
	return {
		id: user.id,
		email: user.email,
		name: user.name,
		userImage: user.image,
	}
}

export async function loginHandler(req: VercelRequest, res: VercelResponse) {
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

	if (email.endsWith(DEMO_DOMAIN)) {
		res.status(403).json({ error: "demo_not_allowed" })
		return
	}

	try {
		const sql = getSql()
		const rows = await sql`
			SELECT id FROM expo_users WHERE lower(email) = ${email} LIMIT 1
		`
		if (rows.length === 0) {
			res.status(404).json({ error: "email_not_found" })
			return
		}

		const response = await webAuthFetch("/api/auth/sign-in/email", {
			method: "POST",
			body: JSON.stringify({ email, password }),
		})

		const data = (await response.json().catch(() => ({}))) as {
			token?: string
			user?: WebAuthUser
			code?: string
		}

		if (!response.ok) {
			if (response.status === 401) {
				res.status(401).json({ error: "invalid_password" })
				return
			}
			res.status(response.status).json({ error: data.code ?? "invalid_input" })
			return
		}

		const token = data.token ?? response.headers.get("set-auth-token")
		if (!token || !data.user) {
			res.status(500).json({ error: "server_error" })
			return
		}

		res.status(200).json({
			token,
			user: mapUser(data.user),
		})
	} catch (error) {
		console.error("[login] error:", error)
		res.status(500).json({ error: "server_error" })
	}
}
