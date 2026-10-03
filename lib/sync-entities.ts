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
	/**
	 * Columna que guarda el `fileKey` remoto (UploadThing). Si está presente, al
	 * borrar un registro se elimina también su binario.
	 */
	remoteKeyColumn?: string
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
		remoteKeyColumn: "remote_key",
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
	informes_iluminacion: {
		table: "expo_informes_iluminacion",
		columns: [
			{ camel: "title", snake: "title", type: "text" },
			{ camel: "empresaId", snake: "empresa_id", type: "text" },
			{ camel: "instrumentoId", snake: "instrumento_id", type: "text" },
			{ camel: "estado", snake: "estado", type: "text" },
			{ camel: "humedad", snake: "humedad", type: "text" },
			{ camel: "temperatura", snake: "temperatura", type: "text" },
			{ camel: "tecnicoSnapshot", snake: "tecnico_snapshot", type: "text" },
			{ camel: "empresaSnapshot", snake: "empresa_snapshot", type: "text" },
			{
				camel: "instrumentoSnapshot",
				snake: "instrumento_snapshot",
				type: "text",
			},
			{ camel: "createdAt", snake: "created_at", type: "text" },
			{ camel: "observacion", snake: "observacion", type: "text" },
			{ camel: "conclusion", snake: "conclusion", type: "text" },
			{ camel: "recomendacion", snake: "recomendacion", type: "text" },
			{ camel: "finishedAt", snake: "finished_at", type: "text" },
			{ camel: "creditConsumed", snake: "credit_consumed", type: "integer" },
			{
				camel: "creditConsumedAt",
				snake: "credit_consumed_at",
				type: "text",
			},
		],
	},
	areas_iluminacion: {
		table: "expo_areas_iluminacion",
		columns: [
			{ camel: "reportId", snake: "report_id", type: "text" },
			{ camel: "nombre", snake: "nombre", type: "text" },
			{ camel: "tipo", snake: "tipo", type: "text" },
			{ camel: "iluminacionTipo", snake: "iluminacion_tipo", type: "text" },
			{
				camel: "iluminacionFuente",
				snake: "iluminacion_fuente",
				type: "text",
			},
			{ camel: "iluminacion", snake: "iluminacion", type: "text" },
			{ camel: "valorRequerido", snake: "valor_requerido", type: "text" },
			{ camel: "observaciones", snake: "observaciones", type: "text" },
			{ camel: "largo", snake: "largo", type: "real" },
			{ camel: "ancho", snake: "ancho", type: "real" },
			{ camel: "alto", snake: "alto", type: "real" },
			{ camel: "imagenes", snake: "imagenes", type: "text" },
			{ camel: "puntos", snake: "puntos", type: "text" },
			{ camel: "timestamps", snake: "timestamps", type: "text" },
		],
	},
	localizadas_iluminacion: {
		table: "expo_localizadas_iluminacion",
		columns: [
			{ camel: "reportId", snake: "report_id", type: "text" },
			{ camel: "nombre", snake: "nombre", type: "text" },
			{ camel: "tipo", snake: "tipo", type: "text" },
			{ camel: "iluminacionTipo", snake: "iluminacion_tipo", type: "text" },
			{
				camel: "iluminacionFuente",
				snake: "iluminacion_fuente",
				type: "text",
			},
			{ camel: "iluminacion", snake: "iluminacion", type: "text" },
			{ camel: "valorRequerido", snake: "valor_requerido", type: "text" },
			{ camel: "observaciones", snake: "observaciones", type: "text" },
			{ camel: "imagenes", snake: "imagenes", type: "text" },
			{ camel: "valor", snake: "valor", type: "integer" },
			{ camel: "timestamps", snake: "timestamps", type: "text" },
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
