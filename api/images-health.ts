import type { VercelRequest, VercelResponse } from "@vercel/node"
import { isAuthorized } from "../lib/auth.js"
import { getSql } from "../lib/db.js"
import { utapi } from "../lib/uploadthing.js"

type ImageRow = {
	id: string
	user_id: string
	remote_url: string | null
	remote_key: string | null
}

const CHECK_TIMEOUT_MS = 8000
const CHUNK_SIZE = 8

async function isReachable(url: string): Promise<boolean> {
	try {
		const response = await fetch(url, {
			method: "HEAD",
			signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
		})
		return response.status >= 200 && response.status < 400
	} catch {
		return false
	}
}

async function checkImage(image: ImageRow): Promise<boolean> {
	if (image.remote_url && (await isReachable(image.remote_url))) return true

	if (image.remote_key) {
		try {
			const { ufsUrl } = await utapi.generateSignedURL(image.remote_key)
			if (await isReachable(ufsUrl)) return true
		} catch {
			// El archivo no existe o no se pudo firmar.
		}
	}

	return false
}

function filterJsonIds(value: unknown, missing: Set<string>): string | null {
	if (typeof value !== "string" || !value) return null
	try {
		const parsed = JSON.parse(value)
		if (!Array.isArray(parsed)) return null
		const filtered = parsed.filter(
			id => typeof id !== "string" || !missing.has(id)
		)
		if (filtered.length === parsed.length) return null
		return JSON.stringify(filtered)
	} catch {
		return null
	}
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
	if (req.method !== "GET" && req.method !== "POST") {
		res.status(405).json({ error: "method_not_allowed" })
		return
	}
	if (!isAuthorized(req.headers.authorization)) {
		res.status(401).json({ error: "unauthorized" })
		return
	}

	const fix = req.query.fix === "1"
	const userId =
		typeof req.query.userId === "string" && req.query.userId
			? req.query.userId
			: null

	try {
		const sql = getSql()
		const images = (await (userId
			? sql`
					SELECT id, user_id, remote_url, remote_key
					FROM expo_images
					WHERE deleted_at IS NULL AND user_id = ${userId}::uuid
					ORDER BY updated_at DESC
					LIMIT 500
				`
			: sql`
					SELECT id, user_id, remote_url, remote_key
					FROM expo_images
					WHERE deleted_at IS NULL
					ORDER BY updated_at DESC
					LIMIT 500
				`)) as ImageRow[]

		const missing: ImageRow[] = []
		for (let i = 0; i < images.length; i += CHUNK_SIZE) {
			const chunk = images.slice(i, i + CHUNK_SIZE)
			const results = await Promise.all(chunk.map(checkImage))
			chunk.forEach((image, index) => {
				if (!results[index]) missing.push(image)
			})
		}

		if (!fix || missing.length === 0) {
			res.status(200).json({
				checked: images.length,
				missing: missing.map(image => ({
					id: image.id,
					userId: image.user_id,
					url: image.remote_url,
				})),
				fixed: false,
			})
			return
		}

		const ids = missing.map(image => image.id)
		const missingSet = new Set(ids)

		// 1) Marcar las imágenes como eliminadas.
		await sql`
			UPDATE expo_images
			SET deleted_at = now(), updated_at = now()
			WHERE id = ANY(${ids}::text[])
		`

		// 2) Limpiar referencias simples.
		await sql`UPDATE expo_tecnicos SET matricula_img = '' WHERE matricula_img = ANY(${ids}::text[])`
		await sql`UPDATE expo_tecnicos SET firma_img = '' WHERE firma_img = ANY(${ids}::text[])`
		await sql`UPDATE expo_tecnicos SET empresa_logo = '' WHERE empresa_logo = ANY(${ids}::text[])`
		await sql`UPDATE expo_empresas SET logo = '' WHERE logo = ANY(${ids}::text[])`

		// 3) Limpiar arrays JSON.
		const arrayTargets = [
			{ table: "expo_instrumentos", columns: ["imagenes_calibracion", "imagenes"] },
			{ table: "expo_areas_iluminacion", columns: ["imagenes"] },
			{
				table: "expo_localizadas_iluminacion",
				columns: ["imagenes"],
			},
		] as const

		for (const target of arrayTargets) {
			const rows = (await sql(
				`SELECT id, ${target.columns.join(", ")} FROM ${target.table}`
			)) as Record<string, unknown>[]

			for (const row of rows) {
				const updates: Record<string, string> = {}
				for (const column of target.columns) {
					const filtered = filterJsonIds(row[column], missingSet)
					if (filtered !== null) updates[column] = filtered
				}
				const entries = Object.entries(updates)
				if (entries.length === 0) continue

				const set = entries
					.map(([column], index) => `${column} = $${index + 2}`)
					.join(", ")
				await sql(`UPDATE ${target.table} SET ${set} WHERE id = $1`, [
					row.id,
					...entries.map(([, value]) => value),
				])
			}
		}

		res.status(200).json({
			checked: images.length,
			missing: missing.map(image => ({
				id: image.id,
				userId: image.user_id,
				url: image.remote_url,
			})),
			fixed: true,
			marked: ids.length,
		})
	} catch (error) {
		console.error("[images-health] error:", error)
		res.status(500).json({ error: "server_error" })
	}
}
