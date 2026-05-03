import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { ListOrdered } from "lucide-react";

interface AdminOrder {
  id: string;
  title: string;
  clientName: string;
  clientEmail: string;
  status: string;
  basePrice: number;
  deadline: string;
  createdAt: string;
  artistId: string;
  artistName: string | null;
  artistEmail: string | null;
}

interface OrdersResponse {
  orders: AdminOrder[];
  total: number;
}

const STATUS_BADGE: Record<string, { text: string; className: string }> = {
  PROPOSED:        { text: "Proposto",          className: "border-blue-700/40 text-blue-400 bg-blue-950/30" },
  PAYMENT_PENDING: { text: "Ag. Pagamento",     className: "border-yellow-700/40 text-yellow-400 bg-yellow-950/30" },
  PAID:            { text: "Pago",              className: "border-green-700/40 text-green-400 bg-green-950/30" },
  IN_PROGRESS:     { text: "Em Andamento",      className: "border-amber-700/40 text-amber-400 bg-amber-950/30" },
  DELIVERED:       { text: "Entregue",          className: "border-green-700/40 text-green-400 bg-green-950/30" },
  CANCELLED:       { text: "Cancelado",         className: "border-red-700/40 text-red-400 bg-red-950/30" },
};

export default function AdminOrders() {
  const [page, setPage] = useState(0);
  const limit = 30;

  const { data, isLoading } = useQuery<OrdersResponse>({
    queryKey: ["admin", "orders", page],
    queryFn: () => api.get<OrdersResponse>(`/admin/orders?limit=${limit}&offset=${page * limit}`),
  });

  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-foreground mb-1">
          Todos os Pedidos
        </h1>
        <p className="text-sm text-muted-foreground">{total} pedidos na plataforma</p>
        <div className="mt-2 h-px w-12 bg-[#C9A961]" />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#C9A961] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {(data?.orders ?? []).map((order) => {
            const badge = STATUS_BADGE[order.status] ?? { text: order.status, className: "" };
            return (
              <Card key={order.id} className="bg-card border-border">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-semibold text-foreground truncate">{order.title}</p>
                        <Badge
                          variant="outline"
                          className={`text-[10px] shrink-0 ${badge.className}`}
                        >
                          {badge.text}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground mt-1">
                        <span>
                          Cliente:{" "}
                          <span className="text-foreground/80">{order.clientName}</span>
                        </span>
                        <span>
                          Artista:{" "}
                          <span className="text-foreground/80">
                            {order.artistName ?? "—"}
                          </span>
                        </span>
                        <span>Prazo: {formatDate(order.deadline)}</span>
                        <span>Criado: {formatDate(order.createdAt)}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-[#C9A961]">
                        {formatCurrency(order.basePrice)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {(data?.orders ?? []).length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <ListOrdered className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhum pedido encontrado</p>
            </div>
          )}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-4">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
          >
            ← Anterior
          </button>
          <span className="text-sm text-muted-foreground">
            {page + 1} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
          >
            Próxima →
          </button>
        </div>
      )}
    </div>
  );
}
