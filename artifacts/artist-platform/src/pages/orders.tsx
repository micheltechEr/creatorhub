import { useState } from "react";
import { useListOrders, getListOrdersQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
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

const STATUS_BADGE: Record<string, { text: string; className: string; borderLeft: string }> = {
  PROPOSED:        { text: "Proposto",          className: "text-[#1E5BA1] bg-[#F0F5FB] border-[#D0E2F4]", borderLeft: "#1E5BA1" },
  PAYMENT_PENDING: { text: "Aguard. Pagamento", className: "text-[#B8860B] bg-[#FFFBF0] border-[#F0D990]", borderLeft: "#B8860B" },
  PAID:            { text: "Pago",              className: "text-[#2D8A45] bg-[#F0F7F2] border-[#B8DFC4]", borderLeft: "#2D8A45" },
  IN_PROGRESS:     { text: "Em Andamento",      className: "text-[#8A6A1B] bg-[#FFFAF0] border-[#E8D5A3]", borderLeft: "#C9A961" },
  DELIVERED:       { text: "Entregue",          className: "text-[#2D8A45] bg-[#F0F7F2] border-[#B8DFC4]", borderLeft: "#2D8A45" },
  CANCELLED:       { text: "Cancelado",         className: "text-[#A53A3A] bg-[#FAF0F0] border-[#E8B8B8]", borderLeft: "#A53A3A" },
};

const ALL_STATUSES = ["PROPOSED", "PAYMENT_PENDING", "PAID", "IN_PROGRESS", "DELIVERED", "CANCELLED"];

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

export default function Orders() {
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const params = statusFilter !== "all" ? { status: statusFilter as any } : {};
  const { data, isLoading } = useListOrders(params, {
    query: { queryKey: getListOrdersQueryKey(params) },
  });

  const orders = data?.orders ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-serif text-4xl font-semibold text-foreground">Pedidos</h1>
          <p className="text-sm text-muted-foreground mt-1 uppercase tracking-[0.3px]">
            {data?.total ?? 0} pedido{(data?.total ?? 0) !== 1 ? "s" : ""} no total
          </p>
        </div>
        <div
          className="flex items-center gap-2 bg-white border border-border px-3 py-2"
          style={{ borderRadius: "2px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
        >
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-52 border-0 shadow-none h-8 text-sm" style={{ borderRadius: "0" }}>
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent style={{ borderRadius: "2px" }}>
              <SelectItem value="all">Todos os status</SelectItem>
              {ALL_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_BADGE[s]?.text ?? s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-20 bg-white border border-border animate-pulse"
              style={{
                borderRadius: "4px",
                background: "linear-gradient(90deg, #fff 0%, #F8F8F8 50%, #fff 100%)",
                backgroundSize: "200% 100%",
                animation: "shimmer 1.5s infinite",
              }}
            />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div
          className="bg-white border border-border p-16 text-center"
          style={{ borderRadius: "4px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
        >
          <p className="text-muted-foreground text-sm">Nenhum pedido encontrado</p>
          <p className="text-muted-foreground text-xs mt-1">
            {statusFilter !== "all"
              ? "Tente remover o filtro de status"
              : "Compartilhe seu perfil para começar a receber pedidos"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const deadline = new Date(order.deadline);
            const now = new Date();
            const daysRemaining = Math.max(
              0,
              Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            );
            const isUrgent =
              daysRemaining <= 2 &&
              order.status !== "DELIVERED" &&
              order.status !== "CANCELLED";
            const borderLeft = STATUS_BADGE[order.status]?.borderLeft ?? "#E5E5E5";

            return (
              <Link key={order.id} href={`/orders/${order.id}`}>
                <div
                  className="bg-white border border-border hover:shadow-md transition-all duration-200 cursor-pointer group"
                  style={{
                    borderRadius: "2px",
                    borderLeft: `4px solid ${borderLeft}`,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                  }}
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <p className="text-sm font-semibold truncate text-foreground">{order.title}</p>
                          {isUrgent && (
                            <AlertCircle className="h-3.5 w-3.5 text-[#B8860B] shrink-0" />
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="font-medium">{order.clientName}</span>
                          <span>{order.clientEmail}</span>
                          {order.occasion && <span>· {order.occasion}</span>}
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span>Prazo: {formatDate(order.deadline as unknown as string)}</span>
                          {order.status !== "DELIVERED" && order.status !== "CANCELLED" && (
                            <span className={daysRemaining <= 2 ? "text-[#B8860B] font-semibold" : ""}>
                              {daysRemaining > 0
                                ? `${daysRemaining} dias restantes`
                                : "Prazo vencido"}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className="text-base font-bold text-foreground">
                          {formatCurrency(order.basePrice)}
                        </span>
                        <StatusBadge status={order.status} />
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
