import { useState } from "react";
import {
  useGetOrder, getGetOrderQueryKey,
  useUpdateOrderStatus,
  useGetPaymentByOrder, getGetPaymentByOrderQueryKey,
  useCreateCheckout,
  getListOrdersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatDate } from "@/lib/format";
import { Link } from "wouter";
import {
  ArrowLeft, CheckCircle2, Clock, XCircle, Play, Package,
  Copy, ExternalLink, QrCode, CreditCard, Landmark,
} from "lucide-react";
import { toast } from "sonner";

const STATUS_BADGE: Record<string, { text: string; className: string; borderColor: string }> = {
  PROPOSED:        { text: "Proposto",           className: "text-[#1E5BA1] bg-[#F0F5FB] border-[#D0E2F4]", borderColor: "#1E5BA1" },
  PAYMENT_PENDING: { text: "Aguard. Pagamento",  className: "text-[#B8860B] bg-[#FFFBF0] border-[#F0D990]", borderColor: "#B8860B" },
  PAID:            { text: "Pago",               className: "text-[#2D8A45] bg-[#F0F7F2] border-[#B8DFC4]", borderColor: "#2D8A45" },
  IN_PROGRESS:     { text: "Em Andamento",       className: "text-[#8A6A1B] bg-[#FFFAF0] border-[#E8D5A3]", borderColor: "#C9A961" },
  DELIVERED:       { text: "Entregue",           className: "text-[#2D8A45] bg-[#F0F7F2] border-[#B8DFC4]", borderColor: "#2D8A45" },
  CANCELLED:       { text: "Cancelado",          className: "text-[#A53A3A] bg-[#FAF0F0] border-[#E8B8B8]", borderColor: "#A53A3A" },
};

const STATUS_LABELS: Record<string, string> = {
  PROPOSED: "Proposto",
  PAYMENT_PENDING: "Aguard. Pagamento",
  PAID: "Pago",
  IN_PROGRESS: "Em Andamento",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelado",
};

const STATUS_TRANSITIONS: Record<string, Array<{ to: string; label: string; variant: "default" | "destructive" | "outline"; icon: any }>> = {
  PROPOSED: [
    { to: "CANCELLED", label: "Cancelar Pedido", variant: "destructive", icon: XCircle },
  ],
  PAYMENT_PENDING: [
    { to: "PAID", label: "Confirmar Pagamento (manual)", variant: "default", icon: CheckCircle2 },
    { to: "PROPOSED", label: "Voltar para Proposto", variant: "outline", icon: ArrowLeft },
  ],
  PAID: [
    { to: "IN_PROGRESS", label: "Iniciar Trabalho", variant: "default", icon: Play },
    { to: "CANCELLED", label: "Cancelar", variant: "destructive", icon: XCircle },
  ],
  IN_PROGRESS: [
    { to: "DELIVERED", label: "Marcar como Entregue", variant: "default", icon: Package },
    { to: "CANCELLED", label: "Cancelar", variant: "destructive", icon: XCircle },
  ],
  DELIVERED: [],
  CANCELLED: [],
};

const STATUS_TIMELINE = ["PROPOSED", "PAYMENT_PENDING", "PAID", "IN_PROGRESS", "DELIVERED"];

const BILLING_TYPES = [
  { value: "PIX", label: "PIX", icon: QrCode, description: "Aprovação imediata" },
  { value: "BOLETO", label: "Boleto", icon: Landmark, description: "Até 3 dias úteis" },
  { value: "CREDIT_CARD", label: "Cartão de Crédito", icon: CreditCard, description: "Via link Asaas" },
];

const cardStyle = { borderRadius: "4px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" };

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_BADGE[status];
  if (!cfg) return <span className="text-xs text-muted-foreground">{status}</span>;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.5px] border ${cfg.className}`}
      style={{ borderRadius: "2px" }}
    >
      {cfg.text}
    </span>
  );
}

function formatCpfCnpj(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
      .replace(/(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3")
      .replace(/(\d{3})(\d{1,3})/, "$1.$2");
  }
  return digits
    .replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")
    .replace(/(\d{2})(\d{3})(\d{3})(\d{1,4})/, "$1.$2.$3/$4")
    .replace(/(\d{2})(\d{3})(\d{1,3})/, "$1.$2.$3")
    .replace(/(\d{2})(\d{1,3})/, "$1.$2");
}

function CheckoutForm({ orderId, onSuccess }: { orderId: string; onSuccess: () => void }) {
  const [billingType, setBillingType] = useState<"PIX" | "BOLETO" | "CREDIT_CARD">("PIX");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const checkout = useCreateCheckout();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = cpfCnpj.replace(/\D/g, "");
    if (digits.length !== 11 && digits.length !== 14) {
      toast.error("Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido");
      return;
    }
    try {
      await checkout.mutateAsync({ data: { orderId, billingType, cpfCnpj: digits } });
      toast.success("Cobrança criada com sucesso!");
      onSuccess();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Erro ao criar cobrança");
    }
  };

  return (
    <div className="bg-white border border-border" style={cardStyle}>
      <div className="px-5 py-4 border-b border-border">
        <p className="text-sm font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4 text-[#C9A961]" />
          Gerar Cobrança Asaas
        </p>
      </div>
      <div className="p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium uppercase tracking-[0.5px] text-[#1F1F1F]">
              CPF / CNPJ do Pagador <span className="text-[#A53A3A]">*</span>
            </Label>
            <Input
              placeholder="000.000.000-00"
              value={cpfCnpj}
              onChange={(e) => setCpfCnpj(formatCpfCnpj(e.target.value))}
              className="h-11 border-border text-sm focus-visible:ring-0 focus-visible:border-foreground"
              style={{ borderRadius: "2px" }}
              required
            />
            <p className="text-xs text-muted-foreground">Obrigatório pela Asaas para emitir a cobrança.</p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-[0.5px] text-[#1F1F1F]">
              Tipo de Cobrança
            </Label>
            <div className="space-y-2">
              {BILLING_TYPES.map((bt) => (
                <button
                  key={bt.value}
                  type="button"
                  onClick={() => setBillingType(bt.value as any)}
                  className={`w-full flex items-center gap-3 p-3 border text-left transition-colors ${
                    billingType === bt.value
                      ? "border-[#C9A961] bg-[#FFFBF0]"
                      : "border-border hover:border-muted-foreground/40"
                  }`}
                  style={{ borderRadius: "2px" }}
                >
                  <bt.icon className={`h-4 w-4 shrink-0 ${billingType === bt.value ? "text-[#B8860B]" : "text-muted-foreground"}`} />
                  <div>
                    <p className={`text-sm font-medium ${billingType === bt.value ? "text-[#8A6A1B]" : "text-foreground"}`}>
                      {bt.label}
                    </p>
                    <p className="text-xs text-muted-foreground">{bt.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <Button
            type="submit"
            className="w-full h-11 text-sm font-semibold bg-[#0A0A0A] text-white hover:bg-[#1F1F1F]"
            style={{ borderRadius: "2px" }}
            disabled={checkout.isPending}
          >
            {checkout.isPending ? "Gerando cobrança..." : "Gerar Cobrança"}
          </Button>
        </form>
      </div>
    </div>
  );
}

function PaymentCard({ payment }: { payment: any }) {
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success(`${label} copiado!`));
  };

  const statusMap: Record<string, { text: string; className: string }> = {
    CONFIRMED: { text: "Confirmado", className: "text-[#2D8A45] bg-[#F0F7F2] border-[#B8DFC4]" },
    PENDING:   { text: "Pendente",   className: "text-[#B8860B] bg-[#FFFBF0] border-[#F0D990]" },
  };
  const statusCfg = statusMap[payment.status] ?? { text: payment.status, className: "text-muted-foreground bg-[#F8F8F8] border-border" };

  return (
    <div className="bg-white border border-border" style={cardStyle}>
      <div className="px-5 py-4 border-b border-border">
        <p className="text-sm font-semibold">Pagamento</p>
      </div>
      <div className="p-5 space-y-3 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Status</span>
          <span
            className={`inline-flex items-center px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.5px] border ${statusCfg.className}`}
            style={{ borderRadius: "2px" }}
          >
            {statusCfg.text}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Tipo</span>
          <span className="font-medium">{payment.billingType ?? payment.provider}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Valor</span>
          <span className="font-bold text-[#C9A961]">{formatCurrency((payment.amount ?? 0) / 100)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Criado</span>
          <span>{formatDate(payment.createdAt)}</span>
        </div>

        {payment.pixQrCode && (
          <div className="pt-2 space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.5px] text-muted-foreground">QR Code PIX</p>
            <div className="flex justify-center">
              <img
                src={`data:image/png;base64,${payment.pixQrCode}`}
                alt="QR Code PIX"
                className="w-40 h-40 border"
                style={{ borderRadius: "2px" }}
              />
            </div>
            {payment.pixCopiaECola && (
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs border-border"
                style={{ borderRadius: "2px" }}
                onClick={() => copyToClipboard(payment.pixCopiaECola, "Código PIX")}
              >
                <Copy className="h-3 w-3 mr-1" /> Copiar código PIX
              </Button>
            )}
          </div>
        )}

        {(payment.checkoutUrl || payment.invoiceUrl) && (
          <a
            href={payment.checkoutUrl ?? payment.invoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1 text-xs text-[#C9A961] hover:underline pt-1"
          >
            <ExternalLink className="h-3 w-3" /> Abrir fatura Asaas
          </a>
        )}

        {payment.boletoUrl && (
          <a
            href={payment.boletoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1 text-xs text-[#C9A961] hover:underline"
          >
            <ExternalLink className="h-3 w-3" /> Visualizar boleto
          </a>
        )}
      </div>
    </div>
  );
}

export default function OrderDetail({ params }: { params: { id: string } }) {
  const queryClient = useQueryClient();
  const { data: order, isLoading } = useGetOrder(params.id, {
    query: { queryKey: getGetOrderQueryKey(params.id) },
  });
  const { data: payment } = useGetPaymentByOrder(params.id, {
    query: { queryKey: getGetPaymentByOrderQueryKey(params.id), retry: false },
  });
  const updateMutation = useUpdateOrderStatus();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetOrderQueryKey(params.id) });
    queryClient.invalidateQueries({ queryKey: getGetPaymentByOrderQueryKey(params.id) });
    queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
  };

  const handleStatusUpdate = async (newStatus: string) => {
    try {
      await updateMutation.mutateAsync({ id: params.id, data: { status: newStatus as any } });
      invalidate();
      toast.success(`Status atualizado para ${STATUS_LABELS[newStatus]}`);
    } catch {
      toast.error("Erro ao atualizar status");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground text-sm">Carregando pedido...</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground mb-4">Pedido não encontrado</p>
        <Link href="/orders">
          <Button variant="outline" style={{ borderRadius: "2px" }}>Voltar para Pedidos</Button>
        </Link>
      </div>
    );
  }

  const deadline = new Date(order.deadline as unknown as string);
  const now = new Date();
  const daysRemaining = Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const transitions = STATUS_TRANSITIONS[order.status] ?? [];
  const currentStepIndex = STATUS_TIMELINE.indexOf(order.status);
  const borderColor = STATUS_BADGE[order.status]?.borderColor ?? "#E5E5E5";

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back + status */}
      <div className="flex items-center gap-3">
        <Link href="/orders">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            style={{ borderRadius: "2px" }}
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
        </Link>
        <StatusBadge status={order.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-5">
          {/* Order card */}
          <div
            className="bg-white border border-border"
            style={{ ...cardStyle, borderLeft: `4px solid ${borderColor}` }}
          >
            <div className="px-6 py-5 border-b border-border">
              <h2 className="font-serif text-2xl font-semibold text-foreground">{order.title}</h2>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.5px] text-muted-foreground mb-1">Cliente</p>
                  <p className="text-sm font-semibold text-foreground">{order.clientName}</p>
                  <p className="text-xs text-muted-foreground">{order.clientEmail}</p>
                </div>
                {order.occasion && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.5px] text-muted-foreground mb-1">Ocasião</p>
                    <p className="text-sm font-semibold text-foreground">{order.occasion}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.5px] text-muted-foreground mb-1">Prazo</p>
                  <p className="text-sm font-semibold text-foreground">{formatDate(order.deadline as unknown as string)}</p>
                  {order.status !== "DELIVERED" && order.status !== "CANCELLED" && (
                    <p className={`text-xs mt-0.5 ${daysRemaining <= 2 ? "text-[#B8860B] font-semibold" : "text-muted-foreground"}`}>
                      {daysRemaining > 0 ? `${daysRemaining} dias restantes` : "Prazo vencido"}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.5px] text-muted-foreground mb-1">Valor</p>
                  <p className="text-xl font-bold text-[#C9A961]">{formatCurrency(order.basePrice)}</p>
                </div>
              </div>

              {order.description && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.5px] text-muted-foreground mb-1">Descrição</p>
                  <p className="text-sm text-foreground leading-relaxed">{order.description}</p>
                </div>
              )}

              {order.names && order.names.length > 0 && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.5px] text-muted-foreground mb-2">Nomes</p>
                  <div className="flex flex-wrap gap-2">
                    {order.names.map((name, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center px-3 py-1 text-xs font-medium bg-[#F8F8F8] border border-border text-foreground"
                        style={{ borderRadius: "2px" }}
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {order.additionalInstructions && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.5px] text-muted-foreground mb-1">Instruções Adicionais</p>
                  <p className="text-sm bg-[#F8F8F8] border border-border p-3 text-foreground leading-relaxed" style={{ borderRadius: "2px" }}>
                    {order.additionalInstructions}
                  </p>
                </div>
              )}

              {order.referenceLinks && order.referenceLinks.length > 0 && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.5px] text-muted-foreground mb-2">Links de Referência</p>
                  <ul className="space-y-1">
                    {order.referenceLinks.map((link, i) => (
                      <li key={i}>
                        <a href={link} target="_blank" rel="noopener noreferrer" className="text-sm text-[#C9A961] hover:underline break-all">
                          {link}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white border border-border" style={cardStyle}>
            <div className="px-5 py-4 border-b border-border">
              <p className="text-sm font-semibold">Progresso do Pedido</p>
            </div>
            <div className="p-5">
              <div className="flex items-center">
                {STATUS_TIMELINE.map((status, index) => {
                  const isPast = index < currentStepIndex || order.status === "DELIVERED";
                  const isCurrent = status === order.status && order.status !== "CANCELLED";
                  const isCancelled = order.status === "CANCELLED";
                  return (
                    <div key={status} className="flex items-center flex-1">
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-8 h-8 flex items-center justify-center text-xs font-bold transition-colors ${
                            isCancelled
                              ? "bg-[#FAF0F0] text-[#A53A3A] border border-[#E8B8B8]"
                              : isPast
                              ? "bg-[#0A0A0A] text-white"
                              : isCurrent
                              ? "bg-[#C9A961] text-white ring-4 ring-[#C9A961]/20"
                              : "bg-[#F0F0F0] text-muted-foreground"
                          }`}
                          style={{ borderRadius: "50%" }}
                        >
                          {isPast ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                        </div>
                        <span className="text-[10px] text-muted-foreground mt-1.5 text-center leading-tight max-w-[58px]">
                          {STATUS_LABELS[status]}
                        </span>
                      </div>
                      {index < STATUS_TIMELINE.length - 1 && (
                        <div
                          className={`flex-1 h-0.5 mx-1 transition-colors ${
                            isPast ? "bg-[#0A0A0A]" : "bg-[#E5E5E5]"
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="bg-white border border-border" style={cardStyle}>
            <div className="px-5 py-4 border-b border-border">
              <p className="text-sm font-semibold">Informações</p>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Criado em</span>
                <span>{formatDate(order.createdAt as unknown as string)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Atualizado em</span>
                <span>{formatDate(order.updatedAt as unknown as string)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">ID</span>
                <span className="font-mono text-xs text-muted-foreground truncate max-w-[160px]">{order.id}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {order.status === "PROPOSED" && !payment && (
            <CheckoutForm orderId={order.id} onSuccess={invalidate} />
          )}

          {transitions.length > 0 && (
            <div className="bg-white border border-border" style={cardStyle}>
              <div className="px-5 py-4 border-b border-border">
                <p className="text-sm font-semibold">Ações</p>
              </div>
              <div className="p-5 space-y-2">
                {transitions.map((t) => (
                  <Button
                    key={t.to}
                    variant={t.variant}
                    className={`w-full justify-start text-sm font-medium ${
                      t.variant === "default"
                        ? "bg-[#0A0A0A] text-white hover:bg-[#1F1F1F]"
                        : t.variant === "outline"
                        ? "border-border text-foreground hover:bg-[#F8F8F8]"
                        : ""
                    }`}
                    style={{ borderRadius: "2px" }}
                    onClick={() => handleStatusUpdate(t.to)}
                    disabled={updateMutation.isPending}
                  >
                    <t.icon className="h-4 w-4 mr-2" />
                    {t.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {payment && <PaymentCard payment={payment} />}
        </div>
      </div>
    </div>
  );
}
