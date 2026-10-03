import type { VercelRequest, VercelResponse } from "@vercel/node"
import { getSessionToken, getSessionUser, isAuthorized } from "../../lib/auth.js"
import { ensureSchema, getSql } from "../../lib/db.js"
import {
	SYNC_ENTITIES,
	type SyncEntity,
	coerceValue,
	getEntity,
} from "../../lib/sync-entities.js"
import { utapi } from "../../lib/uploadthing.js"

/** Retención de tombstones (días) para el cron. */
const RETENTION_DAYS = 30

type Sql = ReturnType<typeof getSql>

function isCron(req: VercelRequest): boolean {
	const secret = process.env.CRON_SECRET
	return !!secret && req.headers.authorization === `Bearer ${secret}`
}

function getEntityName(req: VercelRequest): string {
	const value = req.query.entity
	return Array.isArray(value) ? (value[0] ?? "") : (value ?? "")
}

async function purgeTombstones(sql: Sql): Promise<number> {
	let purged = 0
	for (const entity of Object.values(SYNC_ENTITIES)) {
		const rows = (await sql(
			`
				DELETE FROM ${entity.table}
				WHERE deleted_at IS NOT NULL
				  AND deleted_at < now() - make_interval(days => $1)
				RETURNING id
			`,
			[RETENTION_DAYS]
		)) as { id: string }[]
		purged += rows.length
	}
	return purged
}

async function handleGet(
	sql: Sql,
	entity: SyncEntity,
	userId: string,
	res: VercelResponse
) {
	const selectCols = ["id", ...entity.columns.map(c => c.snake), "updated_at"]
	const rows = (await sql(
		`
			SELECT ${selectCols.join(", ")}
			FROM ${entity.table}
			WHERE user_id = $1 AND deleted_at IS NULL
			ORDER BY updated_at ASC
		`,
		[userId]
	)) as Record<string, unknown>[]

	const items = rows.map(row => {
		const item: Record<string, unknown> = {
			id: row.id,
			updatedAt: row.updated_at,
		}
		for (const col of entity.columns) item[col.camel] = row[col.snake]
		return item
	})

	const deleted = (await sql(
		`SELECT id FROM ${entity.table} WHERE user_id = $1 AND deleted_at IS NOT NULL`,
		[userId]
	)) as { id: string }[]

	res.status(200).json({ items, deletedIds: deleted.map(row => row.id) })
}

async function handleDeleteAll(
	sql: Sql,
	entity: SyncEntity,
	userId: string,
	res: VercelResponse,
	options: { tombstonesOnly?: boolean } = {}
) {
	const where = options.tombstonesOnly
		? "user_id = $1 AND deleted_at IS NOT NULL"
		: "user_id = $1"
	const deleted = (await sql(
		`DELETE FROM ${entity.table} WHERE ${where} RETURNING id`,
		[userId]
	)) as { id: string }[]

	res.status(200).json({ ok: true, deleted: deleted.length })
}

/** Devuelve los `remote_key` de los registros a borrar (para limpiar UploadThing). */
async function fetchRemoteKeys(
	sql: Sql,
	entity: SyncEntity,
	userId: string,
	ids: string[]
): Promise<string[]> {
	const column = entity.remoteKeyColumn
	if (!column || ids.length === 0) return []

	const placeholders = ids.map((_, i) => `$${i + 2}`).join(", ")
	const rows = (await sql(
		`SELECT ${column} AS key FROM ${entity.table}
		 WHERE id IN (${placeholders}) AND user_id = $1 AND ${column} IS NOT NULL`,
		[userId, ...ids]
	)) as { key: string }[]

	return rows.map(row => row.key)
}

async function handleSync(
	sql: Sql,
	entity: SyncEntity,
	userId: string,
	body: { upserts?: unknown; deletes?: unknown },
	res: VercelResponse
) {
	const upserts = Array.isArray(body.upserts)
		? (body.upserts as Record<string, unknown>[])
		: []
	const deletes = Array.isArray(body.deletes)
		? body.deletes.filter((id): id is string => typeof id === "string")
		: []

	const now = new Date().toISOString()
	const colNames = [
		"id",
		"user_id",
		...entity.columns.map(c => c.snake),
		"deleted_at",
		"updated_at",
	]
	const placeholders = colNames.map((_, i) => `$${i + 1}`).join(", ")
	const updates = [
		...entity.columns.map(c => `${c.snake} = EXCLUDED.${c.snake}`),
		"deleted_at = NULL",
		"updated_at = EXCLUDED.updated_at",
	].join(", ")

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const queries: any[] = []

	for (const raw of upserts) {
		const id = raw.id
		if (typeof id !== "string" || !id) continue

		const updatedAt =
			typeof raw.updatedAt === "string" && raw.updatedAt ? raw.updatedAt : now
		const values = [
			id,
			userId,
			...entity.columns.map(c => coerceValue(c.type, raw[c.camel])),
			null,
			updatedAt,
		]

		queries.push(
			sql(
				`
					INSERT INTO ${entity.table} (${colNames.join(", ")})
					VALUES (${placeholders})
					ON CONFLICT (id) DO UPDATE SET ${updates}
					WHERE ${entity.table}.user_id = $2
				`,
				values
			)
		)
	}

	for (const id of deletes) {
		queries.push(
			sql(
				`UPDATE ${entity.table} SET deleted_at = now(), updated_at = now() WHERE id = $1 AND user_id = $2`,
				[id, userId]
			)
		)
	}

	if (queries.length > 0) {
		await sql.transaction(queries)
	}

	// Si la entidad tiene binario remoto (UploadThing), borrarlo al hacer soft delete.
	// Best-effort: NUNCA debe trabar la limpieza de la cola del cliente.
	if (entity.remoteKeyColumn && deletes.length > 0) {
		try {
			const keys = await fetchRemoteKeys(sql, entity, userId, deletes)
			if (keys.length > 0) {
				await utapi.deleteFiles(keys)
			}
		} catch (e) {
			console.error("[sync] no se pudieron borrar los binarios remotos:", e)
		}
	}

	res.status(200).json({ ok: true, synced: queries.length })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
	const entity = getEntity(getEntityName(req))
	if (!entity) {
		res.status(404).json({ error: "unknown_entity" })
		return
	}

	if (req.method !== "GET" && req.method !== "POST" && req.method !== "DELETE") {
		res.status(405).json({ error: "method_not_allowed" })
		return
	}

	const cron = isCron(req)
	if (!cron && !isAuthorized(req.headers.authorization)) {
		res.status(401).json({ error: "unauthorized" })
		return
	}

	try {
		await ensureSchema()
		const sql = getSql()

		// Cron: purga dura de tombstones viejos de todas las entidades.
		if (cron) {
			if (req.method !== "GET") {
				res.status(405).json({ error: "method_not_allowed" })
				return
			}
			const purged = await purgeTombstones(sql)
			res.status(200).json({ ok: true, purged })
			return
		}

		const token = getSessionToken(req)
		if (!token) {
			res.status(401).json({ error: "no_session" })
			return
		}

		const user = await getSessionUser(token)
		if (!user) {
			res.status(401).json({ error: "invalid_session" })
			return
		}

		if (req.method === "GET") {
			// Acción de URL firmada (archivos privados en UploadThing).
			const sign = req.query.sign
			if (entity.remoteKeyColumn && typeof sign === "string" && sign) {
				const { ufsUrl } = await utapi.generateSignedURL(sign)
				res.status(200).json({ url: ufsUrl })
				return
			}
			await handleGet(sql, entity, user.id, res)
			return
		}
		if (req.method === "DELETE") {
			await handleDeleteAll(sql, entity, user.id, res, {
				tombstonesOnly: req.query.purge === "1",
			})
			return
		}
		await handleSync(
			sql,
			entity,
			user.id,
			(req.body ?? {}) as { upserts?: unknown; deletes?: unknown },
			res
		)
	} catch (e) {
		console.error("[sync] error:", e)
		res.status(500).json({ error: "no se pudo sincronizar" })
	}
}
