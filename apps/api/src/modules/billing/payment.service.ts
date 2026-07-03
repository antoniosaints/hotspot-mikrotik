export type MercadoPagoConfig = {
  accessToken: string;
  webhookSecret?: string | null;
};

export type CreatePixPaymentInput = {
  amountCentavos: number;
  description: string;
  payerEmail?: string | null;
  externalReference: string;
  notificationUrl: string;
};

export type PixPaymentResult = {
  id: string;
  status: string;
  qrCode: string | null;
  qrCodeBase64: string | null;
};

export type MercadoPagoPayment = {
  id: string;
  status: string;
  externalReference: string | null;
};

const MERCADO_PAGO_API = "https://api.mercadopago.com";
const DEFAULT_PAYER_EMAIL = "comprador@hotspot.local";

function centsToAmount(cents: number) {
  return Number((cents / 100).toFixed(2));
}

async function parseMercadoPagoResponse(response: Response) {
  const text = await response.text();
  const data = text ? JSON.parse(text) as Record<string, unknown> : {};

  if (!response.ok) {
    const message = typeof data.message === "string" ? data.message : `Mercado Pago retornou HTTP ${response.status}.`;
    throw new Error(message);
  }

  return data;
}

export async function createPixPayment(config: MercadoPagoConfig, input: CreatePixPaymentInput): Promise<PixPaymentResult> {
  const response = await fetch(`${MERCADO_PAGO_API}/v1/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": input.externalReference,
    },
    body: JSON.stringify({
      transaction_amount: centsToAmount(input.amountCentavos),
      description: input.description,
      payment_method_id: "pix",
      payer: {
        email: input.payerEmail || DEFAULT_PAYER_EMAIL,
      },
      external_reference: input.externalReference,
      notification_url: input.notificationUrl,
    }),
  });

  const data = await parseMercadoPagoResponse(response);
  const point = data.point_of_interaction as { transaction_data?: { qr_code?: string; qr_code_base64?: string } } | undefined;

  return {
    id: String(data.id),
    status: String(data.status ?? "pending"),
    qrCode: point?.transaction_data?.qr_code ?? null,
    qrCodeBase64: point?.transaction_data?.qr_code_base64 ?? null,
  };
}

export async function getPayment(config: MercadoPagoConfig, paymentId: string): Promise<MercadoPagoPayment> {
  const response = await fetch(`${MERCADO_PAGO_API}/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${config.accessToken}` },
  });
  const data = await parseMercadoPagoResponse(response);

  return {
    id: String(data.id),
    status: String(data.status ?? ""),
    externalReference: typeof data.external_reference === "string" ? data.external_reference : null,
  };
}

export function isApprovedPayment(payment: MercadoPagoPayment) {
  return payment.status === "approved";
}
