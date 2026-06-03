import { db } from "@workspace/db";
import {
  asaasAccountsTable,
  artistsTable,
  paymentsTable,
  ordersTable,
  artistWalletsTable,
  walletTransactionsTable,
  asaasEventsTable,
  withdrawalRequestsTable,
  artistPayoutSettingsTable,
  type InsertAsaasAccount,
  type InsertWalletTransaction,
  type InsertWithdrawalRequest,
} from "@workspace/db/schema";
import { eq, and, lte } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────────────────────
// Provider interface — permite trocar de gateway no futuro
// ─────────────────────────────────────────────────────────────────────────────
export interface IAsaasProvider {
  createCustomer(data: { name: string; email: string }): Promise<{ customerId: string; walletId: string }>;
  createPayment(data: {
    customerId: string;
    amount: number;
    description: string;
    externalReference: string;
    billingType?: string;
    dueDate?: string;
  }): Promise<{
    paymentId: string;
    status: string;
    billingType: string;
    checkoutUrl?: string;
    invoiceUrl?: string;
    pixQrCode?: string;
    pixCopiaECola?: string;
  }>;
  createTransfer(data: {
    value: number;
    pixAddressKey: string;
    pixAddressKeyType: string;
    description?: string;
  }): Promise<{ transferId: string; status: string }>;
  getTransferStatus(transferId: string): Promise<{ status: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Implementação HTTP da Asaas
// ─────────────────────────────────────────────────────────────────────────────
export class AsaasProvider implements IAsaasProvider {
  private apiKey = process.env.ASAAS_API_KEY ?? "";
  private baseUrl = process.env.ASAAS_BASE_URL ?? "https://sandbox.asaas.com/api/v3";

  private headers() {
    return {
      "Content-Type": "application/json",
      access_token: this.apiKey,
    };
  }

  async createCustomer(data: { name: string; email: string }) {
    const resp = await fetch(`${this.baseUrl}/customers`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ name: data.name, email: data.email }),
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Asaas createCustomer failed (${resp.status}): ${err}`);
    }
    const json = (await resp.json()) as { id: string; walletId?: string };
    return { customerId: json.id, walletId: json.walletId ?? json.id };
  }

  async createPayment(data: {
    customerId: string;
    amount: number;
    description: string;
    externalReference: string;
    billingType?: string;
    dueDate?: string;
  }) {
    const resp = await fetch(`${this.baseUrl}/payments`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        customer: data.customerId,
        billingType: data.billingType ?? "PIX",
        value: data.amount,
        description: data.description,
        externalReference: data.externalReference,
        dueDate: data.dueDate ?? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      }),
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Asaas createPayment failed (${resp.status}): ${err}`);
    }
    const json = (await resp.json()) as any;
    return {
      paymentId: json.id as string,
      status: json.status as string,
      billingType: json.billingType as string,
      checkoutUrl: json.invoiceUrl as string | undefined,
      invoiceUrl: json.invoiceUrl as string | undefined,
      pixQrCode: json.pixQrCodeBase64 as string | undefined,
      pixCopiaECola: json.pixCopyPaste as string | undefined,
    };
  }

  async createTransfer(data: {
    value: number;
    pixAddressKey: string;
    pixAddressKeyType: string;
    description?: string;
  }) {
    const resp = await fetch(`${this.baseUrl}/transfers`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        value: data.value,
        pixAddressKey: data.pixAddressKey,
        pixAddressKeyType: data.pixAddressKeyType,
        description: data.description ?? "Saque artista",
      }),
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Asaas createTransfer failed (${resp.status}): ${err}`);
    }
    const json = (await resp.json()) as { id: string; status: string };
    return { transferId: json.id, status: json.status };
  }

  async getTransferStatus(transferId: string) {
    const resp = await fetch(`${this.baseUrl}/transfers/${transferId}`, {
      headers: this.headers(),
    });
    if (!resp.ok) throw new Error(`Asaas getTransferStatus failed (${resp.status})`);
    const json = (await resp.json()) as { status: string };
    return { status: json.status };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
export const PLATFORM_FEE_BPS = 2000;            // 20%
export const SECURITY_PERIOD_DAYS = 7;
export const MIN_WITHDRAWAL_CENTS = 5000;        // R$ 50,00
const BPS_DIVISOR = 10_000;

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────
export class AsaasService {
  constructor(private provider: IAsaasProvider) {}

  // ── Conectar artista ao Asaas ──────────────────────────────────────────────
  async connectArtist(artistId: string) {
    const [artist] = await db
      .select()
      .from(artistsTable)
      .where(eq(artistsTable.id, artistId))
      .limit(1);

    if (!artist) throw new Error("Artist not found");

    // Já conectado?
    const [existing] = await db
      .select()
      .from(asaasAccountsTable)
      .where(eq(asaasAccountsTable.artistId, artistId))
      .limit(1);

    if (existing) {
      return { walletId: existing.walletId, status: existing.status };
    }

    const { customerId, walletId } = await this.provider.createCustomer({
      name: artist.name,
      email: artist.email,
    });

    const insert: InsertAsaasAccount = {
      artistId: artist.id,
      asaasCustomerId: customerId,
      walletId,
      status: "ACTIVE",
    };
    await db.insert(asaasAccountsTable).values(insert);

    // Criar wallet se não existir
    await this.ensureWallet(artistId);

    return { walletId, status: "ACTIVE" };
  }

  // ── Garantir que o artista tem uma wallet ──────────────────────────────────
  private async ensureWallet(artistId: string) {
    const [existing] = await db
      .select()
      .from(artistWalletsTable)
      .where(eq(artistWalletsTable.artistId, artistId))
      .limit(1);

    if (existing) return existing;

    const [wallet] = await db
      .insert(artistWalletsTable)
      .values({ artistId })
      .returning();

    return wallet;
  }

  // ── Criar cobrança para um pedido ──────────────────────────────────────────
  async createPaymentForOrder(orderId: string) {
    const [order] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId))
      .limit(1);
    if (!order) throw new Error("Order not found");

    // Buscar customerId do Asaas
    const [asaasAccount] = await db
      .select()
      .from(asaasAccountsTable)
      .where(eq(asaasAccountsTable.artistId, order.artistId))
      .limit(1);
    if (!asaasAccount) throw new Error("Artist not connected to Asaas");

    const amount = Number(order.basePrice);

    const result = await this.provider.createPayment({
      customerId: asaasAccount.asaasCustomerId,
      amount,
      description: `Pedido: ${order.title}`,
      externalReference: orderId,
    });

    // Salvar pagamento no DB
    await db.insert(paymentsTable).values({
      orderId,
      amount,
      currency: "BRL",
      status: "PENDING",
      provider: "asaas",
      transactionId: result.paymentId,
      asaasPaymentId: result.paymentId,
      asaasCustomerId: asaasAccount.asaasCustomerId,
      billingType: result.billingType,
      checkoutUrl: result.checkoutUrl,
      invoiceUrl: result.invoiceUrl,
      pixQrCode: result.pixQrCode,
      pixCopiaECola: result.pixCopiaECola,
    });

    // Atualizar status do pedido
    await db
      .update(ordersTable)
      .set({ status: "PAYMENT_PENDING", updatedAt: new Date() })
      .where(eq(ordersTable.id, orderId));

    return {
      paymentId: result.paymentId,
      checkoutUrl: result.checkoutUrl,
      pixQrCode: result.pixQrCode,
      pixCopiaECola: result.pixCopiaECola,
    };
  }

  // ── Processar webhook do Asaas ─────────────────────────────────────────────
  async handleWebhook(event: { id: string; event: string; payment?: any; transfer?: any }) {
    // Idempotência: verificar se evento já foi processado
    const [existingEvent] = await db
      .select()
      .from(asaasEventsTable)
      .where(eq(asaasEventsTable.eventId, event.id))
      .limit(1);

    if (existingEvent) {
      return { processed: false, reason: "duplicate" };
    }

    // Registrar evento
    await db.insert(asaasEventsTable).values({
      eventId: event.id,
      eventType: event.event,
      payload: event as any,
    });

    switch (event.event) {
      case "PAYMENT_RECEIVED":
      case "PAYMENT_CONFIRMED":
        if (event.payment) {
          await this.handlePaymentConfirmed(event.payment);
        }
        break;

      case "TRANSFER_DONE":
      case "TRANSFER_COMPLETED":
        if (event.transfer) {
          await this.handleTransferCompleted(event.transfer);
        }
        break;

      case "TRANSFER_FAILED":
      case "TRANSFER_CANCELLED":
        if (event.transfer) {
          await this.handleTransferFailed(event.transfer);
        }
        break;

      default:
        // Evento não tratado — ignorar silenciosamente
        break;
    }

    return { processed: true };
  }

  // ── Pagamento confirmado → creditar wallet ─────────────────────────────────
  private async handlePaymentConfirmed(payment: any) {
    const asaasPaymentId: string = payment.id;
    const externalReference: string | undefined = payment.externalReference;

    if (!externalReference) {
      console.warn("[AsaasService] Payment without externalReference:", asaasPaymentId);
      return;
    }

    const orderId = externalReference;

    // Atualizar status do pagamento
    await db
      .update(paymentsTable)
      .set({ status: "CONFIRMED", updatedAt: new Date() })
      .where(eq(paymentsTable.asaasPaymentId, asaasPaymentId));

    // Atualizar status do pedido
    await db
      .update(ordersTable)
      .set({ status: "PAID", updatedAt: new Date() })
      .where(eq(ordersTable.id, orderId));

    // Buscar order para saber o artista e valor
    const [order] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId))
      .limit(1);

    if (!order) return;

    const totalAmount = Number(order.basePrice);
    const platformFee = Math.floor((totalAmount * PLATFORM_FEE_BPS) / BPS_DIVISOR);
    const artistAmount = totalAmount - platformFee;

    // Garantir wallet
    const wallet = await this.ensureWallet(order.artistId);
    const now = new Date();
    const availableAt = new Date(now.getTime() + SECURITY_PERIOD_DAYS * 24 * 60 * 60 * 1000);

    // Inserir transação de crédito (fonte da verdade)
    await db.insert(walletTransactionsTable).values({
      walletId: wallet.id,
      orderId,
      type: "CREDIT" as const,
      amount: artistAmount,
      status: "PENDING_SECURITY" as const,
      availableAt,
      description: `Pagamento pedido: ${order.title}`,
    });

    // Atualizar saldo consolidado
    await db
      .update(artistWalletsTable)
      .set({
        pendingBalance: wallet.pendingBalance + artistAmount,
        totalEarned: wallet.totalEarned + artistAmount,
        updatedAt: now,
      })
      .where(eq(artistWalletsTable.id, wallet.id));
  }

  // ── Transferência concluída → atualizar withdrawal ─────────────────────────
  private async handleTransferCompleted(transfer: any) {
    const transferId: string = transfer.id;

    await db
      .update(withdrawalRequestsTable)
      .set({ status: "COMPLETED", updatedAt: new Date() })
      .where(eq(withdrawalRequestsTable.asaasTransferId, transferId));
  }

  // ── Transferência falhou → reverter saldo ──────────────────────────────────
  private async handleTransferFailed(transfer: any) {
    const transferId: string = transfer.id;
    const failureReason: string = transfer.failReason ?? "Transfer failed";

    const [withdrawal] = await db
      .select()
      .from(withdrawalRequestsTable)
      .where(eq(withdrawalRequestsTable.asaasTransferId, transferId))
      .limit(1);

    if (!withdrawal) return;

    await db
      .update(withdrawalRequestsTable)
      .set({ status: "FAILED", failureReason, updatedAt: new Date() })
      .where(eq(withdrawalRequestsTable.id, withdrawal.id));

    // Reverter saldo: devolver ao availableBalance
    const [wallet] = await db
      .select()
      .from(artistWalletsTable)
      .where(eq(artistWalletsTable.id, withdrawal.walletId))
      .limit(1);

    if (wallet) {
      await db
        .update(artistWalletsTable)
        .set({
          availableBalance: wallet.availableBalance + withdrawal.amount,
          totalWithdrawn: wallet.totalWithdrawn - withdrawal.amount,
          updatedAt: new Date(),
        })
        .where(eq(artistWalletsTable.id, wallet.id));

      // Registrar transação de estorno
      await db.insert(walletTransactionsTable).values({
        walletId: wallet.id,
        type: "DEBIT",
        amount: -withdrawal.amount,
        status: "SETTLED",
        availableAt: new Date(),
        description: `Estorno saque falho: ${withdrawal.id}`,
      });
    }
  }

  // ── Solicitar saque ────────────────────────────────────────────────────────
  async requestWithdrawal(artistId: string, amountCents: number) {
    if (amountCents < MIN_WITHDRAWAL_CENTS) {
      throw new Error(`Valor mínimo para saque: R$ ${(MIN_WITHDRAWAL_CENTS / 100).toFixed(2)}`);
    }

    // Buscar payout settings
    const [payoutSettings] = await db
      .select()
      .from(artistPayoutSettingsTable)
      .where(eq(artistPayoutSettingsTable.artistId, artistId))
      .limit(1);

    if (!payoutSettings) {
      throw new Error("Configure sua chave PIX antes de solicitar saque");
    }

    // Usar transação DB com SELECT FOR UPDATE para evitar double-spend
    const result = await db.transaction(async (tx) => {
      // Lock da wallet
      const [wallet] = await tx
        .select()
        .from(artistWalletsTable)
        .where(eq(artistWalletsTable.artistId, artistId))
        .limit(1)
        .for("update");

      if (!wallet) throw new Error("Wallet not found");

      if (wallet.availableBalance < amountCents) {
        throw new Error(
          `Saldo insuficiente. Disponível: R$ ${(wallet.availableBalance / 100).toFixed(2)}`
        );
      }

      // Debitar saldo
      await tx
        .update(artistWalletsTable)
        .set({
          availableBalance: wallet.availableBalance - amountCents,
          totalWithdrawn: wallet.totalWithdrawn + amountCents,
          updatedAt: new Date(),
        })
        .where(eq(artistWalletsTable.id, wallet.id));

      // Registrar transação de saque
      await tx.insert(walletTransactionsTable).values({
        walletId: wallet.id,
        type: "WITHDRAWAL",
        amount: -amountCents,
        status: "SETTLED",
        availableAt: new Date(),
        description: `Saque via PIX`,
      });

      // Criar withdrawal request
      const [withdrawal] = await tx
        .insert(withdrawalRequestsTable)
        .values({
          walletId: wallet.id,
          artistId,
          amount: amountCents,
          status: "PENDING",
        })
        .returning();

      return withdrawal;
    });

    // Enviar transferência ao Asaas (fora da transação DB)
    try {
      const transferResult = await this.provider.createTransfer({
        value: amountCents / 100, // Asaas espera valor em reais
        pixAddressKey: payoutSettings.pixKey,
        pixAddressKeyType: payoutSettings.pixKeyType,
        description: `Saque artista ${artistId}`,
      });

      await db
        .update(withdrawalRequestsTable)
        .set({
          status: "PROCESSING",
          asaasTransferId: transferResult.transferId,
          updatedAt: new Date(),
        })
        .where(eq(withdrawalRequestsTable.id, result.id));

      return {
        withdrawalId: result.id,
        status: "PROCESSING",
        amount: amountCents,
        pixKey: payoutSettings.pixKey,
      };
    } catch (err: any) {
      // Falha ao enviar: reverter saldo
      await db
        .update(withdrawalRequestsTable)
        .set({ status: "FAILED", failureReason: err.message, updatedAt: new Date() })
        .where(eq(withdrawalRequestsTable.id, result.id));

      // Reverter saldo
      const [wallet] = await db
        .select()
        .from(artistWalletsTable)
        .where(eq(artistWalletsTable.artistId, artistId))
        .limit(1);

      if (wallet) {
        await db
          .update(artistWalletsTable)
          .set({
            availableBalance: wallet.availableBalance + amountCents,
            totalWithdrawn: wallet.totalWithdrawn - amountCents,
            updatedAt: new Date(),
          })
          .where(eq(artistWalletsTable.id, wallet.id));
      }

      throw new Error(`Falha ao processar saque: ${err.message}`);
    }
  }

  // ── Job: processar transações com período de segurança expirado ─────────────
  async processPendingTransactions() {
    const now = new Date();

    // Buscar transações PENDING_SECURITY cujo availableAt já passou
    const pendingTxs = await db
      .select()
      .from(walletTransactionsTable)
      .where(
        and(
          eq(walletTransactionsTable.status, "PENDING_SECURITY"),
          lte(walletTransactionsTable.availableAt, now)
        )
      );

    for (const tx of pendingTxs) {
      await db.transaction(async (trx) => {
        // Atualizar status da transação
        await trx
          .update(walletTransactionsTable)
          .set({ status: "AVAILABLE" })
          .where(eq(walletTransactionsTable.id, tx.id));

        // Atualizar saldos consolidados
        const [wallet] = await trx
          .select()
          .from(artistWalletsTable)
          .where(eq(artistWalletsTable.id, tx.walletId))
          .limit(1)
          .for("update");

        if (wallet) {
          await trx
            .update(artistWalletsTable)
            .set({
              pendingBalance: Math.max(0, wallet.pendingBalance - tx.amount),
              availableBalance: wallet.availableBalance + tx.amount,
              updatedAt: now,
            })
            .where(eq(artistWalletsTable.id, wallet.id));
        }
      });
    }

    return { processed: pendingTxs.length };
  }

  // ── Buscar saldo do artista ────────────────────────────────────────────────
  async getWallet(artistId: string) {
    const wallet = await this.ensureWallet(artistId);
    return wallet;
  }

  // ── Buscar transações do artista ───────────────────────────────────────────
  async getTransactions(artistId: string, limit = 50, offset = 0) {
    const wallet = await this.ensureWallet(artistId);

    const transactions = await db
      .select()
      .from(walletTransactionsTable)
      .where(eq(walletTransactionsTable.walletId, wallet.id))
      .orderBy(walletTransactionsTable.createdAt)
      .limit(limit)
      .offset(offset);

    return { wallet, transactions };
  }

  // ── Buscar/configurar payout settings ──────────────────────────────────────
  async getPayoutSettings(artistId: string) {
    const [settings] = await db
      .select()
      .from(artistPayoutSettingsTable)
      .where(eq(artistPayoutSettingsTable.artistId, artistId))
      .limit(1);

    return settings ?? null;
  }

  async updatePayoutSettings(artistId: string, pixKey: string, pixKeyType: string) {
    const existing = await this.getPayoutSettings(artistId);
    const typedPixKeyType = pixKeyType as "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";

    if (existing) {
      const [updated] = await db
        .update(artistPayoutSettingsTable)
        .set({ pixKey, pixKeyType: typedPixKeyType, updatedAt: new Date() })
        .where(eq(artistPayoutSettingsTable.artistId, artistId))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(artistPayoutSettingsTable)
      .values({ artistId, pixKey, pixKeyType: typedPixKeyType })
      .returning();
    return created;
  }

  // ── Buscar histórico de saques ─────────────────────────────────────────────
  async getWithdrawals(artistId: string) {
    return db
      .select()
      .from(withdrawalRequestsTable)
      .where(eq(withdrawalRequestsTable.artistId, artistId))
      .orderBy(withdrawalRequestsTable.createdAt);
  }
}

// Singleton
export const asaasProvider = new AsaasProvider();
export const asaasService = new AsaasService(asaasProvider);