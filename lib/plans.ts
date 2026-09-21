export type Plan = {
	id: string
	title: string
	price: number
	credits: number
}

/**
 * Planes comprables (los mismos de la app, `constants/index.ts` → PLANS).
 * El plan "Gratis" no se compra, por eso no está acá.
 */
export const PLANS: Record<string, Plan> = {
	"por-informe": {
		id: "por-informe",
		title: "Por Informe",
		price: 18,
		credits: 1,
	},
	mensual: {
		id: "mensual",
		title: "Mensual",
		price: 55,
		credits: 7,
	},
	anual: {
		id: "anual",
		title: "Anual",
		price: 560,
		credits: 100,
	},
}

export function getPlan(planId: string): Plan | undefined {
	return PLANS[planId]
}
