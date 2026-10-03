import {
	createUploadthing,
	type FileRouter,
	UploadThingError,
	UTApi,
} from "uploadthing/server"
import { getSessionUser, isAuthorized } from "./auth.js"
import { ensureSchema } from "./db.js"

const f = createUploadthing()

/** Cliente server-side de UploadThing (borrar/listar archivos). */
export const utapi = new UTApi()

/**
 * FileRouter de UploadThing.
 *
 * El binario se sube **directo** de la app a UploadThing; este endpoint solo
 * maneja el handshake (presign/callback), siempre con sesión válida. La metadata
 * (`imageId` ↔ `fileKey`) la persiste la app vía `POST /sync/images`.
 */
export const uploadRouter = {
	imageUploader: f({
		image: { maxFileSize: "8MB", maxFileCount: 1 },
	})
		.middleware(async ({ req }) => {
			if (!isAuthorized(req.headers.get("authorization") ?? undefined)) {
				throw new UploadThingError("Unauthorized")
			}

			const token = req.headers.get("x-session-token")
			if (!token) throw new UploadThingError("No session")

			await ensureSchema()
			const user = await getSessionUser(token)
			if (!user) throw new UploadThingError("Invalid session")

			return { userId: user.id }
		})
		.onUploadComplete(({ metadata }) => {
			return { userId: metadata.userId }
		}),
} satisfies FileRouter

export type UploadRouter = typeof uploadRouter
