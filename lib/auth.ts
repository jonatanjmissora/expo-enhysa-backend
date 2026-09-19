export function isAuthorized(authHeader?: string): boolean {
	const token = authHeader?.replace(/^Bearer\s+/i, "")
	const expected = process.env.API_TOKEN
	if (!expected) return false
	return !!token && token === expected
}
