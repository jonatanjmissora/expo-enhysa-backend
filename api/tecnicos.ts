import type { VercelRequest, VercelResponse } from "@vercel/node"
import { getSessionToken, getSessionUser, isAuthorized } from "../lib/auth.js"
import { ensureSchema, getSql } from "../lib/db.js"

type TecnicoRow = {
	id: string
	nombre: string | null
	telefono: string | null
	localidad: string | null
	cargo: string | null
	matricula: string | null
	matricula_img: string | null
	firma_img: string | null
	empresa_logo: string | null
	dni: number | null
	updated_at: string
}

function toApi(row: TecnicoRow) {
	return {
		id: row.id,
		nombre: row.nombre,
		telefono: row.telefono,
		localidad: row.localidad,
		cargo: row.cargo,
		matricula: row.matricula,
		matriculaImg: row.matricula_img,
		firmaImg: row.firma_img,
		empresaLogo: row.empresa_logo,
		dni: row.dni,
		updatedAt: row.updated_at,
	}
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
	if (req.method !== "GET" && req.method !== "DELETE") {
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

	try {
		await ensureSchema()
		const user = await getSessionUser(token)
		if (!user) {
			res.status(401).json({ error: "invalid_session" })
			return
		}

		const sql = getSql()

		// "Empezar de cero": se elimina TODO lo del usuario en la nube.
		if (req.method === "DELETE") {
			const deleted = await sql`
				DELETE FROM expo_tecnicos
				WHERE user_id = ${user.id}
				RETURNING id
			`
			res.status(200).json({ ok: true, deleted: deleted.length })
			return
		}

		const rows = (await sql`
			SELECT
				id, nombre, telefono, localidad, cargo, matricula,
				matricula_img, firma_img, empresa_logo, dni, updated_at
			FROM expo_tecnicos
			WHERE user_id = ${user.id} AND deleted_at IS NULL
			ORDER BY updated_at ASC
		`) as TecnicoRow[]

		// Tombstones: ids borrados (soft delete), para que el cliente no los
		// resucite en el merge y pueda limpiarlos del lado local.
		const deleted = (await sql`
			SELECT id
			FROM expo_tecnicos
			WHERE user_id = ${user.id} AND deleted_at IS NOT NULL
		`) as { id: string }[]

		res.status(200).json({
			tecnicos: rows.map(toApi),
			deletedIds: deleted.map(row => row.id),
		})
	} catch (e) {
		console.error("[tecnicos] error:", e)
		res.status(500).json({ error: "no se pudieron obtener los técnicos" })
	}
}
