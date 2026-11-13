export type WebAuthUser = {
	id: string
	email: string
	name: string | null
	image: string | null
	emailVerified?: boolean
}

export function getWebAuthUrl(): string {
	const url = process.env.WEB_AUTH_URL
	if (!url) throw new Error("WEB_AUTH_URL no configurada")
	return url.replace(/\/$/, "")
}

export async function webAuthFetch(
	path: string,
	init: RequestInit = {}
): Promise<Response> {
	const baseUrl = getWebAuthUrl()
	const headers = new Headers(init.headers)
	headers.set("Content-Type", "application/json")
	headers.set("Origin", baseUrl)

	return fetch(`${baseUrl}${path}`, {
		...init,
		headers,
	})
}

export async function getWebSession(token: string): Promise<{
	user: WebAuthUser
} | null> {
	const response = await webAuthFetch("/api/auth/get-session", {
		method: "GET",
		headers: {
			Authorization: `Bearer ${token}`,
		},
	})

	if (!response.ok) return null

	const data = (await response.json()) as { user?: WebAuthUser } | null
	if (!data?.user) return null

	return { user: data.user }
}
