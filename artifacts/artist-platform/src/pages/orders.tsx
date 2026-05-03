import { useState } from "react";
import { useListOrders, getListOrdersQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/format";
import { Link } from "wouter";
import { AlertCircle, ChevronRight, Filter } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUS_COLORS: Record<string, string> = {
  PROPOSED: "bg-gray-100 text-gray-700 border-gray-200",
  PAYMENT_PENDING: "bg-yellow-100 text-yellow-800 border-yellow-200",
  PAID: "bg-green-100 text-green-800 border-green-200",
  IN_PROGRESS: "bg-blue-100 text-blue-800 border-blue-200",
  DELIVERED: "bg-purple-100 text-purple-800 border-purple-200",
  CANCELLED: "bg-red-100 text-red-800 border-red-200",
};

const STATUS_LABELS: Record<string, string> = {
  PROPOSED: "Proposto",
  PAYMENT_PENDING: "Aguard. Pagamento",
  PAID: "Pago",
  IN_PROGRESS: "Em Andamento",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelado",
};

const ALL_STATUSES = ["PROPOSED", "PAYMENT_PENDING", "PAID", "IN_PROGRESS", "DELIVERED", "CANCELLED"];

export default function Orders() {
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const params = statusFilter !== "all" ? { status: statusFilter as any } : {};
  const { data, isLoading } = useListOrders(params, {
    query: { queryKey: getListOrdersQueryKey(params) },
  });

  const orders = data?.orders ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pedidos</h1>
          <p className="text-muted-foreground mt-1">
            {data?.total ?? 0} pedido{(data?.total ?? 0) !== 1 ? "s" : ""} no total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {ALL_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-muted-foreground text-lg">Nenhum pedido encontrado</p>
            <p className="text-muted-foreground text-sm mt-1">
              {statusFilter !== "all"
                ? "Tente remover o filtro de status"
                : "Compartilhe seu perfil para comecar a receber pedidos"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const deadline = new Date(order.deadline);
            const now = new Date();
            const daysRemaining = Math.max(
              0,
              Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            );
            const isUrgent = daysRemaining <= 2 && order.status !== "DELIVERED" && order.status !== "CANCELLED";

            return (
              <Link key={order.id} href={`/orders/${order.id}`}>
                <Card className="hover:shadow-md transition-all cursor-pointer border-border hover:border-primary/30">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold truncate">{order.title}</p>
                          {isUrgent && (
                            <AlertCircle className="h-4 w-4 text-yellow-500 shrink-0" />
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          <span>{order.clientName}</span>
                          <span>{order.clientEmail}</span>
                          {order.occasion && <span>· {order.occasion}</span>}
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span>Prazo: {formatDate(order.deadline as unknown as string)}</span>
                          {order.status !== "DELIVERED" && order.status !== "CANCELLED" && (
                            <span
                              className={
                                daysRemaining <= 2 ? "text-yellow-600 font-medium" : ""
                              }
                            >
                              {daysRemaining > 0
                                ? `${daysRemaining} dias restantes`
                                : "Prazo vencido"}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className="text-lg font-bold">
                          {formatCurrency(order.basePrice)}
                        </span>
                        <Badge
                          className={`text-xs ${STATUS_COLORS[order.status] ?? ""}`}
                          variant="outline"
                        >
                          {STATUS_LABELS[order.status] ?? order.status}
                        </Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
