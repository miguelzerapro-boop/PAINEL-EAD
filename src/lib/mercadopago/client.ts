import 'server-only'

import { MercadoPagoConfig, Payment, Preference } from 'mercadopago'

let config: MercadoPagoConfig | undefined

export function getMercadoPago() {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!accessToken) {
    throw new Error(
      'MERCADOPAGO_ACCESS_TOKEN ausente. O checkout fica indisponivel ate a credencial ser configurada.',
    )
  }
  config ??= new MercadoPagoConfig({
    accessToken,
    options: { timeout: 8000 },
  })
  return config
}

export function paymentClient() {
  return new Payment(getMercadoPago())
}

export function preferenceClient() {
  return new Preference(getMercadoPago())
}

/** O checkout so aparece quando as credenciais existem. */
export function isCheckoutConfigured() {
  return Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN && process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY)
}
