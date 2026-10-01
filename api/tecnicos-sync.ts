import type { VercelRequest, VercelResponse } from "@vercel/node"
import { getSessionToken, getSessionUser, isAuthorized } from "../lib/auth.js"
import { ensureSchema, getSql } from "../lib/db.js"

type TecnicoUpsert = {
	id?: unknown
	nombre?: unknown
	telefono?: unknown
	localidad?: unknown
	cargo?: unknown
	matricula?: unknown
	matriculaImg?: unknown
	firmaImg?: unknown
	empresaLogo?: unknown
	dni?: unknown
	updatedAt?: unknown
}

function asText(value: unknown): string | null {
	return typeof value === "string" && value.length > 0 ? value : null
}

function asNumber(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) ? value : null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
		res.status(401).json({ error: "no_session" })
		return
	}

	const body = (req.body ?? {}) as { upserts?: unknown; deletes?: unknown }
	const upserts = Array.isArray(body.upserts)
		? (body.upserts as TecnicoUpsert[])
		: []
	const deletes = Array.isArray(body.deletes)
		? body.deletes.filter((id): id is string => typeof id === "string")
		: []

	try {
		await ensureSchema()
		const user = await getSessionUser(token)
		if (!user) {
			res.status(401).json({ error: "invalid_session" })
			return
		}

		const sql = getSql()
		const now = new Date().toISOString()
		const queries = []

		for (const raw of upserts) {
			const id = asText(raw.id)
			if (!id) continue

			// Idempotente por `id`. `WHERE user_id` evita pisar filas de otro usuario.
			queries.push(sql`
				INSERT INTO expo_tecnicos (
					id, user_id, nombre, telefono, localidad, cargo, matricula,
					matricula_img, firma_img, empresa_logo, dni, deleted_at, updated_at
				)
				VALUES (
					${id}, ${user.id},
					${asText(raw.nombre)}, ${asText(raw.telefono)}, ${asText(raw.localidad)},
					${asText(raw.cargo)}, ${asText(raw.matricula)},
					${asText(raw.matriculaImg)}, ${asText(raw.firmaImg)}, ${asText(raw.empresaLogo)},
					${asNumber(raw.dni)}, NULL, ${asText(raw.updatedAt) ?? now}
				)
				ON CONFLICT (id) DO UPDATE SET
					nombre = EXCLUDED.nombre,
					telefono = EXCLUDED.telefono,
					localidad = EXCLUDED.localidad,
					cargo = EXCLUDED.cargo,
					matricula = EXCLUDED.matricula,
					matricula_img = EXCLUDED.matricula_img,
					firma_img = EXCLUDED.firma_img,
					empresa_logo = EXCLUDED.empresa_logo,
					dni = EXCLUDED.dni,
					deleted_at = NULL,
					updated_at = EXCLUDED.updated_at
				WHERE expo_tecnicos.user_id = ${user.id}
			`)
		}

		for (const id of deletes) {
			// Soft delete (tombstone) para que un restore futuro no lo resucite.
			queries.push(sql`
				UPDATE expo_tecnicos
				SET deleted_at = now(), updated_at = now()
				WHERE id = ${id} AND user_id = ${user.id}
			`)
		}

		if (queries.length > 0) {
			await sql.transaction(queries)
		}

		res.status(200).json({ ok: true, synced: queries.length })
	} catch (e) {
		console.error("[tecnicos-sync] error:", e)
		res.status(500).json({ error: "no se pudo sincronizar" })
	}
}
