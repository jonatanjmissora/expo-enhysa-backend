import {
	MercadoPagoConfig,
	Payment,
	Preference,
} from "mercadopago"

export function isSandbox(): boolean {
	return process.env.MP_ENV !== "production"
}

function getConfig(): MercadoPagoConfig {
	const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN
	if (!accessToken) throw new Error("MERCADO_PAGO_ACCESS_TOKEN no configurada")
	return new MercadoPagoConfig({ accessToken })
}

type PreferenceBody = Parameters<Preference["create"]>[0]["body"]

export async function createPreference(body: PreferenceBody) {
	const preference = new Preference(getConfig())
	return preference.create({ body })
}

export async function getPaymentById(id: number | string) {
	const payment = new Payment(getConfig())
	return payment.get({ id })
}
