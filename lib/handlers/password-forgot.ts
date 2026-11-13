import type { VercelRequest, VercelResponse } from "@vercel/node"
import { isAuthorized } from "../auth.js"

/**
 * El reset de contraseña ahora lo maneja Better Auth desde la web.
 * Se deshabilita temporalmente en el backend del APK.
 */
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

	res.status(501).json({ error: "password_reset_disabled" })
}
