import { Resend } from "resend"

let client: Resend | null = null

function getResend(): Resend | null {
	const key = process.env.RESEND_API_KEY
	if (!key) return null
	if (!client) client = new Resend(key)
	return client
}

function getResetDeepLink(): string {
	return (
		process.env.APP_RESET_DEEP_LINK ?? "expoenhysa://auth/reset-password"
	)
}

/**
 * Envía el link de reset (deep link). Best-effort: si Resend no está
 * configurado, loguea y no rompe el flujo del endpoint.
 */
export async function sendPasswordResetEmail(
	to: string,
	token: string
): Promise<void> {
	const resend = getResend()
	const from = process.env.EMAIL_FROM
	if (!resend || !from) {
		console.warn("[email] Resend no configurado; se omite el envío")
		return
	}

	const link = `${getResetDeepLink()}?token=${token}`

	const { error } = await resend.emails.send({
		from,
		to,
		subject: "Recuperá tu contraseña — EnHySa",
		html: `
			<div style="font-family: sans-serif; line-height: 1.5; color: #1e293b;">
				<h2>Recuperá tu contraseña</h2>
				<p>Recibimos un pedido para restablecer tu contraseña de EnHySa.</p>
				<p>
					<a href="${link}" style="display:inline-block;padding:12px 20px;background:#f97316;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">
						Restablecer contraseña
					</a>
				</p>
				<p>Este link <strong>expira en 10 minutos</strong> y es de <strong>un solo uso</strong>.</p>
				<p>Si no pediste este cambio, ignorá este mensaje.</p>
			</div>
		`,
	})

	if (error) {
		console.error("[email] error:", error)
	}
}
