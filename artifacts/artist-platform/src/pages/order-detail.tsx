import { useGetOrder, getGetOrderQueryKey, useUpdateOrderStatus, useGetPaymentByOrder, getGetPaymentByOrderQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { Link } from "wouter";
import { ArrowLeft, CheckCircle2, Clock, XCircle, Play, Package } from "lucide-react";
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

const TRANSITIONS: Record<string, Array<{ to: string; label: string; variant: "default" | "destructive" | "outline"; icon: any }>> = {
  PROPOSED: [
    { to: "PAYMENT_PENDING", label: "Iniciar Pagamento", variant: "default", icon: Clock },
    { to: "CANCELLED", label: "Cancelar", variant: "destructive", icon: XCircle },
  ],
  PAYMENT_PENDING: [
    { to: "PAID", label: "Confirmar Pagamento", variant: "default", icon: CheckCircle2 },
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

export default function OrderDetail({ params }: { params: { id: string } }) {
  const queryClient = useQueryClient();
  const { data: order, isLoading } = useGetOrder(params.id, {
    query: { queryKey: getGetOrderQueryKey(params.id) },
  });
  const { data: payment } = useGetPaymentByOrder(params.id, {
    query: { queryKey: getGetPaymentByOrderQueryKey(params.id), retry: false },
  });
  const updateMutation = useUpdateOrderStatus();

  const handleStatusUpdate = async (newStatus: string) => {
    try {
      await updateMutation.mutateAsync({ id: params.id, data: { status: newStatus as any } });
      queryClient.invalidateQueries({ queryKey: getGetOrderQueryKey(params.id) });
      queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
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
        <p className="text-muted-foreground">Pedido nao encontrado</p>
        <Link href="/orders"><Button variant="outline" className="mt-4">Voltar para Pedidos</Button></Link>
      </div>
    );
  }

  const deadline = new Date(order.deadline);
  const now = new Date();
  const daysRemaining = Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const transitions = TRANSITIONS[order.status] ?? [];
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
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Ocasiao</p>
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
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Descricao</p>
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
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Instrucoes Adicionais</p>
                  <p className="text-sm bg-muted/50 rounded-md p-3">{order.additionalInstructions}</p>
                </div>
              )}

              {order.referenceLinks && order.referenceLinks.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Links de Referencia</p>
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
          {/* Actions */}
          {transitions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Acoes</CardTitle>
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

          {/* Payment info */}
          {payment && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pagamento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant="outline" className={payment.status === "CONFIRMED" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                    {payment.status === "CONFIRMED" ? "Confirmado" : "Pendente"}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gateway</span>
                  <span className="font-medium capitalize">{payment.provider}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor</span>
                  <span className="font-bold">{formatCurrency(payment.amount / 100)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Data</span>
                  <span>{formatDate(payment.createdAt as unknown as string)}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informacoes</CardTitle>
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
