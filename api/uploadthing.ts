import type { VercelRequest, VercelResponse } from "@vercel/node"
import { createRouteHandler } from "uploadthing/server"
import { uploadRouter } from "../lib/uploadthing.js"

const handlers = createRouteHandler({
	router: uploadRouter,
	config: {
		token: process.env.UPLOADTHING_TOKEN,
		isDev: process.env.NODE_ENV !== "production",
	},
})

/** Adapta el `VercelRequest` (Node) al `Request` Web que espera UploadThing. */
function toWebRequest(req: VercelRequest): Request {
	const protocol = (req.headers["x-forwarded-proto"] as string) ?? "https"
	const host = req.headers.host ?? "localhost"
	const url = `${protocol}://${host}${req.url ?? ""}`

	const headers = new Headers()
	for (const [key, value] of Object.entries(req.headers)) {
		if (Array.isArray(value)) {
			for (const item of value) headers.append(key, item)
		} else if (typeof value === "string") {
			headers.set(key, value)
		}
	}

	const method = req.method ?? "GET"
	const body =
		method === "GET" || method === "HEAD"
			? undefined
			: JSON.stringify(req.body ?? {})

	return new Request(url, { method, headers, body })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
	// CORS (para Expo web / preflight de headers custom).
	res.setHeader("Access-Control-Allow-Origin", "*")
	res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
	res.setHeader("Access-Control-Allow-Headers", "*")

	if (req.method === "OPTIONS") {
		res.status(204).end()
		return
	}

	if (req.method !== "GET" && req.method !== "POST") {
		res.status(405).json({ error: "method_not_allowed" })
		return
	}

	try {
		const response = await handlers(toWebRequest(req))

		res.status(response.status)
		response.headers.forEach((value: string, key: string) => {
			res.setHeader(key, value)
		})
		res.send(await response.text())
	} catch (e) {
		console.error("[uploadthing] error:", e)
		res.status(500).json({ error: "uploadthing_error" })
	}
}
