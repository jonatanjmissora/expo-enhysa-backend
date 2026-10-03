export type SyncColumnType = "text" | "integer" | "real"

export type SyncColumn = {
	/** Nombre del campo en la API (camelCase). */
	camel: string
	/** Nombre de la columna en Postgres (snake_case). */
	snake: string
	type: SyncColumnType
}

export type SyncEntity = {
	/** Tabla en Neon (ya incluye el prefijo `expo_`). */
	table: string
	columns: SyncColumn[]
}

/**
 * Registro de entidades sincronizables. Agregar una entidad acá es lo único que
 * hace falta para que `api/sync/[entity].ts` la soporte (crear su tabla en Neon
 * y su contraparte local).
 *
 * Todas las tablas comparten: `id TEXT PRIMARY KEY`, `user_id UUID`,
 * `deleted_at TIMESTAMPTZ` y `updated_at TIMESTAMPTZ`.
 */
export const SYNC_ENTITIES: Record<string, SyncEntity> = {
	tecnicos: {
		table: "expo_tecnicos",
		columns: [
			{ camel: "nombre", snake: "nombre", type: "text" },
			{ camel: "telefono", snake: "telefono", type: "text" },
			{ camel: "localidad", snake: "localidad", type: "text" },
			{ camel: "cargo", snake: "cargo", type: "text" },
			{ camel: "matricula", snake: "matricula", type: "text" },
			{ camel: "matriculaImg", snake: "matricula_img", type: "text" },
			{ camel: "firmaImg", snake: "firma_img", type: "text" },
			{ camel: "empresaLogo", snake: "empresa_logo", type: "text" },
			{ camel: "dni", snake: "dni", type: "integer" },
		],
	},
	empresas: {
		table: "expo_empresas",
		columns: [
			{ camel: "cuit", snake: "cuit", type: "text" },
			{ camel: "razonSocial", snake: "razon_social", type: "text" },
			{ camel: "direccion", snake: "direccion", type: "text" },
			{ camel: "localidad", snake: "localidad", type: "text" },
			{ camel: "provincia", snake: "provincia", type: "text" },
			{ camel: "codigoPostal", snake: "codigo_postal", type: "text" },
			{ camel: "horarios", snake: "horarios", type: "text" },
			{ camel: "logo", snake: "logo", type: "text" },
		],
	},
	instrumentos: {
		table: "expo_instrumentos",
		columns: [
			{ camel: "nombre", snake: "nombre", type: "text" },
			{ camel: "marca", snake: "marca", type: "text" },
			{ camel: "modelo", snake: "modelo", type: "text" },
			{ camel: "serie", snake: "serie", type: "text" },
			{ camel: "fechaCalibracion", snake: "fecha_calibracion", type: "text" },
			{
				camel: "imagenesCalibracion",
				snake: "imagenes_calibracion",
				type: "text",
			},
			{ camel: "imagenes", snake: "imagenes", type: "text" },
		],
	},
	images: {
		table: "expo_images",
		columns: [
			{ camel: "filename", snake: "filename", type: "text" },
			{ camel: "mimeType", snake: "mime_type", type: "text" },
			{ camel: "width", snake: "width", type: "integer" },
			{ camel: "height", snake: "height", type: "integer" },
			{ camel: "size", snake: "size", type: "integer" },
			{ camel: "remoteKey", snake: "remote_key", type: "text" },
			{ camel: "remoteUrl", snake: "remote_url", type: "text" },
		],
	},
}

export function getEntity(name: string): SyncEntity | null {
	return SYNC_ENTITIES[name] ?? null
}

export function coerceValue(
	type: SyncColumnType,
	value: unknown
): string | number | null {
	if (value === undefined || value === null) return null
	if (type === "text") return typeof value === "string" ? value : null
	return typeof value === "number" && Number.isFinite(value) ? value : null
}
