import type { VercelRequest, VercelResponse } from "@vercel/node"
import { isAuthorized } from "../auth.js"
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

export async function registerHandler(req: VercelRequest, res: VercelResponse) {
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

	if (email.endsWith(DEMO_DOMAIN)) {
		res.status(403).json({ error: "demo_not_allowed" })
		return
	}

	try {
		const response = await webAuthFetch("/api/auth/sign-up/email", {
			method: "POST",
			body: JSON.stringify({ email, password, name: name ?? "" }),
		})

		const data = (await response.json().catch(() => ({}))) as {
			token?: string
			user?: WebAuthUser
			code?: string
		}

		if (!response.ok) {
			if (
				response.status === 422 ||
				data.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" ||
				data.code === "USER_ALREADY_EXISTS"
			) {
				res.status(409).json({ error: "email_exists" })
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
		console.error("[register] error:", error)
		res.status(500).json({ error: "server_error" })
	}
}
