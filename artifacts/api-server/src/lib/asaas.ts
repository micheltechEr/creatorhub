/**
 * Asaas payment gateway client
 * Docs: https://docs.asaas.com
 * Sandbox: https://sandbox.asaas.com/api/v3
 * Production: https://api.asaas.com/v3
 */

const ASAAS_ENV = process.env.ASAAS_ENV ?? "sandbox";
const ASAAS_API_KEY = process.env.ASAAS_API_KEY ?? "";

const BASE_URL =
  ASAAS_ENV === "production"
    ? "https://api.asaas.com/v3"
    : "https://sandbox.asaas.com/api/v3";

// ─── Types ───────────────────────────────────────────────────────────────────

export type BillingType = "PIX" | "BOLETO" | "CREDIT_CARD" | "UNDEFINED";

export interface AsaasCustomer {
  id: string;
  name: string;
  email: string;
  cpfCnpj?: string;
}

export interface AsaasPayment {
  id: string;
  customer: string;
  billingType: BillingType;
  value: number;
  netValue: number;
  dueDate: string;
  status: string; // PENDING | RECEIVED | CONFIRMED | OVERDUE | REFUNDED | RECEIVED_IN_CASH | REFUND_REQUESTED | CHARGEBACK_REQUESTED | CHARGEBACK_DISPUTE | AWAITING_CHARGEBACK_REVERSAL | DUNNING_REQUESTED | DUNNING_RECEIVED | AWAITING_RISK_ANALYSIS
  invoiceUrl: string;
  bankSlipUrl: string | null;
  invoiceNumber: string;
  externalReference: string;
  deleted: boolean;
}

export interface AsaasPixQrCode {
  encodedImage: string;  // base64 PNG
  payload: string;       // copia-e-cola string
  expirationDate: string;
}

export interface CreateCustomerInput {
  name: string;
  email: string;
  cpfCnpj?: string;
  phone?: string;
}

export interface CreatePaymentInput {
  customer: string;           // Asaas customer ID
  billingType: BillingType;
  value: number;              // amount in BRL (not cents)
  dueDate: string;            // YYYY-MM-DD
  description: string;
  externalReference?: string; // your order ID
  postalService?: boolean;
}

// ─── HTTP helper ─────────────────────────────────────────────────────────────

async function asaasRequest<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "access_token": ASAAS_API_KEY,
    "User-Agent": "CREATOR HUB/1.0",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Asaas ${method} ${path} → ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// ─── Customer ────────────────────────────────────────────────────────────────

export async function findOrCreateCustomer(
  input: CreateCustomerInput
): Promise<AsaasCustomer> {
  // Try to find existing customer by email
  const search = await asaasRequest<{ data: AsaasCustomer[] }>(
    "GET",
    `/customers?email=${encodeURIComponent(input.email)}`
  );

  if (search.data.length > 0) {
    const existing = search.data[0];

    // If the caller provided a CPF/CNPJ but the stored customer doesn't have one, patch it
    if (input.cpfCnpj && !existing.cpfCnpj) {
      return asaasRequest<AsaasCustomer>("PUT", `/customers/${existing.id}`, {
        cpfCnpj: input.cpfCnpj,
      });
    }

    return existing;
  }

  // Create a new customer
  return asaasRequest<AsaasCustomer>("POST", "/customers", {
    name: input.name,
    email: input.email,
    cpfCnpj: input.cpfCnpj,
    phone: input.phone,
    notificationDisabled: false,
  });
}

// ─── Payment ─────────────────────────────────────────────────────────────────

export async function createPayment(
  input: CreatePaymentInput
): Promise<AsaasPayment> {
  return asaasRequest<AsaasPayment>("POST", "/payments", {
    customer: input.customer,
    billingType: input.billingType,
    value: input.value,
    dueDate: input.dueDate,
    description: input.description,
    externalReference: input.externalReference,
    postalService: false,
  });
}

export async function getPayment(asaasPaymentId: string): Promise<AsaasPayment> {
  return asaasRequest<AsaasPayment>("GET", `/payments/${asaasPaymentId}`);
}

export async function getPixQrCode(
  asaasPaymentId: string
): Promise<AsaasPixQrCode> {
  return asaasRequest<AsaasPixQrCode>(
    "GET",
    `/payments/${asaasPaymentId}/pixQrCode`
  );
}

// ─── Status mapping ──────────────────────────────────────────────────────────

/** Map Asaas payment status to our internal payment status */
export function mapAsaasStatus(asaasStatus: string): string {
  switch (asaasStatus) {
    case "RECEIVED":
    case "CONFIRMED":
    case "RECEIVED_IN_CASH":
      return "CONFIRMED";
    case "REFUNDED":
    case "REFUND_REQUESTED":
      return "REFUNDED";
    case "OVERDUE":
      return "OVERDUE";
    case "PENDING":
    default:
      return "PENDING";
  }
}

/** Due date for a new payment — always tomorrow at minimum */
export function dueDateString(days = 1): string {
  const d = new Date();
  d.setDate(d.getDate() + Math.max(1, days));
  return d.toISOString().split("T")[0];
}
