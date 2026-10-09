import { createHash, randomBytes } from "node:crypto"

/** Token opaco de un solo uso para reset de contraseña (256 bits). */
export function generateResetToken(): string {
	return randomBytes(32).toString("hex")
}

/** SHA-256 del token: en la DB solo se guarda este hash, nunca el token. */
export function hashResetToken(token: string): string {
	return createHash("sha256").update(token).digest("hex")
}
