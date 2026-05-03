import { useState } from "react";
import {
  useGetOrder, getGetOrderQueryKey,
  useUpdateOrderStatus,
  useGetPaymentByOrder, getGetPaymentByOrderQueryKey,
  useCreateCheckout,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { getListOrdersQueryKey } from "@workspace/api-client-react";

const STATUS_COLORS: Record<string, string> = {
  PROPOSED: "bg-gray-100 text-gray-700",
  PAYMENT_PENDING: "bg-yellow-100 text-yellow-800",
  PAID: "bg-green-100 text-green-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  DELIVERED: "bg-purple-100 text-purple-800",
  CANCELLED: "bg-red-100 text-red-800",
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

function formatCpfCnpj(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
      .replace(/(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3")
      .replace(/(\d{3})(\d{1,3})/, "$1.$2");
  }
  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")
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
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          Gerar Cobrança Asaas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="cpfcnpj" className="text-xs font-medium">
              CPF / CNPJ do Pagador <span className="text-red-500">*</span>
            </Label>
            <Input
              id="cpfcnpj"
              placeholder="000.000.000-00"
              value={cpfCnpj}
              onChange={(e) => setCpfCnpj(formatCpfCnpj(e.target.value))}
              required
            />
            <p className="text-xs text-muted-foreground">Obrigatório pela Asaas para emitir a cobrança.</p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium">Tipo de Cobrança</Label>
            <div className="grid grid-cols-1 gap-2">
              {BILLING_TYPES.map((bt) => (
                <button
                  key={bt.value}
                  type="button"
                  onClick={() => setBillingType(bt.value as any)}
                  className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                    billingType === bt.value
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border hover:border-muted-foreground/40"
                  }`}
                >
                  <bt.icon className="h-4 w-4 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{bt.label}</p>
                    <p className="text-xs text-muted-foreground">{bt.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={checkout.isPending}>
            {checkout.isPending ? "Gerando cobrança..." : "Gerar Cobrança"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PaymentCard({ payment }: { payment: any }) {
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success(`${label} copiado!`));
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Pagamento</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Status</span>
          <Badge variant="outline" className={
            payment.status === "CONFIRMED" ? "bg-green-100 text-green-800" :
            payment.status === "PENDING" ? "bg-yellow-100 text-yellow-800" :
            "bg-gray-100 text-gray-700"
          }>
            {payment.status === "CONFIRMED" ? "Confirmado" :
             payment.status === "PENDING" ? "Pendente" : payment.status}
          </Badge>
        </div>

        <div className="flex justify-between">
          <span className="text-muted-foreground">Tipo</span>
          <span className="font-medium">{payment.billingType ?? payment.provider}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-muted-foreground">Valor</span>
          <span className="font-bold text-primary">{formatCurrency((payment.amount ?? 0) / 100)}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-muted-foreground">Criado</span>
          <span>{formatDate(payment.createdAt)}</span>
        </div>

        {/* PIX QR Code */}
        {payment.pixQrCode && (
          <div className="pt-2 space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">QR Code PIX</p>
            <div className="flex justify-center">
              <img
                src={`data:image/png;base64,${payment.pixQrCode}`}
                alt="QR Code PIX"
                className="w-40 h-40 border rounded-lg"
              />
            </div>
            {payment.pixCopiaECola && (
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => copyToClipboard(payment.pixCopiaECola, "Código PIX")}
              >
                <Copy className="h-3 w-3 mr-1" />
                Copiar código PIX
              </Button>
            )}
          </div>
        )}

        {/* Checkout / Invoice URL */}
        {(payment.checkoutUrl || payment.invoiceUrl) && (
          <a
            href={payment.checkoutUrl ?? payment.invoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1 text-xs text-primary hover:underline pt-1"
          >
            <ExternalLink className="h-3 w-3" />
            Abrir fatura Asaas
          </a>
        )}

        {/* Boleto URL */}
        {payment.boletoUrl && (
          <a
            href={payment.boletoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1 text-xs text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            Visualizar boleto
          </a>
        )}
      </CardContent>
    </Card>
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
        <div className="animate-pulse text-muted-foreground">Carregando pedido...</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Pedido não encontrado</p>
        <Link href="/orders"><Button variant="outline" className="mt-4">Voltar para Pedidos</Button></Link>
      </div>
    );
  }

  const deadline = new Date(order.deadline as unknown as string);
  const now = new Date();
  const daysRemaining = Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const transitions = STATUS_TRANSITIONS[order.status] ?? [];
  const currentStepIndex = STATUS_TIMELINE.indexOf(order.status);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/orders">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
        </Link>
        <Badge className={`${STATUS_COLORS[order.status] ?? ""}`} variant="outline">
          {STATUS_LABELS[order.status] ?? order.status}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">{order.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Cliente</p>
                  <p className="font-medium">{order.clientName}</p>
                  <p className="text-sm text-muted-foreground">{order.clientEmail}</p>
                </div>
                {order.occasion && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Ocasião</p>
                    <p className="font-medium">{order.occasion}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Prazo</p>
                  <p className="font-medium">{formatDate(order.deadline as unknown as string)}</p>
                  {order.status !== "DELIVERED" && order.status !== "CANCELLED" && (
                    <p className={`text-sm ${daysRemaining <= 2 ? "text-yellow-600 font-medium" : "text-muted-foreground"}`}>
                      {daysRemaining > 0 ? `${daysRemaining} dias restantes` : "Prazo vencido"}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Valor</p>
                  <p className="text-xl font-bold text-primary">{formatCurrency(order.basePrice)}</p>
                </div>
              </div>

              {order.description && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Descrição</p>
                  <p className="text-sm">{order.description}</p>
                </div>
              )}

              {order.names && order.names.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Nomes</p>
                  <div className="flex flex-wrap gap-2">
                    {order.names.map((name, i) => (
                      <Badge key={i} variant="secondary">{name}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {order.additionalInstructions && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Instruções Adicionais</p>
                  <p className="text-sm bg-muted/50 rounded-md p-3">{order.additionalInstructions}</p>
                </div>
              )}

              {order.referenceLinks && order.referenceLinks.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Links de Referência</p>
                  <ul className="space-y-1">
                    {order.referenceLinks.map((link, i) => (
                      <li key={i}>
                        <a href={link} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline break-all">
                          {link}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Progresso do Pedido</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                {STATUS_TIMELINE.map((status, index) => {
                  const isPast = index < currentStepIndex || order.status === "DELIVERED";
                  const isCurrent = status === order.status && order.status !== "CANCELLED";
                  const isCancelled = order.status === "CANCELLED";
                  return (
                    <div key={status} className="flex items-center flex-1">
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                          isCancelled ? "bg-red-100 text-red-500" :
                          isPast ? "bg-primary text-primary-foreground" :
                          isCurrent ? "bg-primary text-primary-foreground ring-4 ring-primary/20" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {isPast ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                        </div>
                        <span className="text-xs text-muted-foreground mt-1 text-center leading-tight max-w-[60px]">
                          {STATUS_LABELS[status]}
                        </span>
                      </div>
                      {index < STATUS_TIMELINE.length - 1 && (
                        <div className={`flex-1 h-0.5 mx-1 transition-colors ${isPast ? "bg-primary" : "bg-muted"}`} />
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Checkout form — only shown for PROPOSED orders without a payment yet */}
          {order.status === "PROPOSED" && !payment && (
            <CheckoutForm orderId={order.id} onSuccess={invalidate} />
          )}

          {/* Manual status actions */}
          {transitions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {transitions.map((t) => (
                  <Button
                    key={t.to}
                    variant={t.variant}
                    className="w-full justify-start"
                    onClick={() => handleStatusUpdate(t.to)}
                    disabled={updateMutation.isPending}
                  >
                    <t.icon className="h-4 w-4 mr-2" />
                    {t.label}
                  </Button>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Payment card */}
          {payment && <PaymentCard payment={payment} />}

          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
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
                <span className="font-mono text-xs text-muted-foreground truncate max-w-[120px]">{order.id}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
