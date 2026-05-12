import {
  useGetDashboardStats,
  getGetDashboardStatsQueryKey,
  useGetRecentOrders,
  getGetRecentOrdersQueryKey,
  useGetEarnings,
  getGetEarningsQueryKey,
  useToggleAvailability,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { formatCurrency, formatDate } from "@/lib/format";
import { Link } from "wouter";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, Clock, CheckCircle2, Star, ArrowRight, AlertCircle, ListOrdered } from "lucide-react";
import { toast } from "sonner";

const STATUS_BADGE: Record<string, { text: string; className: string; borderColor: string }> = {
  PROPOSED:        { text: "Proposto",           className: "text-[#1E5BA1] bg-[#F0F5FB] dark:bg-[#0D1B2A] dark:text-[#6FA8DC] border-[#D0E2F4] dark:border-[#1E3A5F]", borderColor: "#1E5BA1" },
  PAYMENT_PENDING: { text: "Aguard. Pagamento",  className: "text-[#B8860B] bg-[#FFFBF0] dark:bg-[#2A2000] dark:text-[#F0D990] border-[#F0D990] dark:border-[#3D2E00]", borderColor: "#B8860B" },
  PAID:            { text: "Pago",               className: "text-[#2D8A45] bg-[#F0F7F2] dark:bg-[#0D2818] dark:text-[#6FCF8C] border-[#B8DFC4] dark:border-[#1A4D2E]", borderColor: "#2D8A45" },
  IN_PROGRESS:     { text: "Em Andamento",       className: "text-[#8A6A1B] bg-[#FFFAF0] dark:bg-[#2A2000] dark:text-[#C9A961] border-[#E8D5A3] dark:border-[#3D2E00]", borderColor: "#C9A961" },
  DELIVERED:       { text: "Entregue",           className: "text-[#2D8A45] bg-[#F0F7F2] dark:bg-[#0D2818] dark:text-[#6FCF8C] border-[#B8DFC4] dark:border-[#1A4D2E]", borderColor: "#2D8A45" },
  CANCELLED:       { text: "Cancelado",          className: "text-[#A53A3A] bg-[#FAF0F0] dark:bg-[#2A0D0D] dark:text-[#E88B8B] border-[#E8B8B8] dark:border-[#5A1A1A]", borderColor: "#A53A3A" },
};

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

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="h-10 w-48 mb-2" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats({
    query: { queryKey: getGetDashboardStatsQueryKey() },
  });
  const { data: recentData, isLoading: recentLoading } = useGetRecentOrders(
    {},
    { query: { queryKey: getGetRecentOrdersQueryKey() } },
  );
  const { data: earningsData } = useGetEarnings(
    {},
    { query: { queryKey: getGetEarningsQueryKey() } },
  );
  const toggleMutation = useToggleAvailability();

  const handleToggleAvailability = async () => {
    try {
      await toggleMutation.mutateAsync({ data: { availability: !stats?.availability } });
      queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
      toast.success(stats?.availability ? "Disponibilidade desativada" : "Disponibilidade ativada");
    } catch {
      toast.error("Erro ao atualizar disponibilidade");
    }
  };

  const chartData =
    earningsData?.monthly?.map((m) => ({
      name: `${m.month}/${m.year}`,
      ganhos: m.earnings,
    })) ?? [];

  if (statsLoading) return <DashboardSkeleton />;

  return (
    <div className="space-y-8">
      <Breadcrumb items={[{ label: "Dashboard" }]} />

      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="font-serif text-4xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1 uppercase tracking-[0.3px]">
            Visão geral da sua atividade
          </p>
        </div>
        <div
          className="flex items-center gap-3 bg-card border border-border px-4 py-3"
          style={{ borderRadius: "4px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
        >
          <span className="text-xs font-medium uppercase tracking-[0.5px] text-muted-foreground">
            Disponível
          </span>
          <Switch
            checked={stats?.availability ?? false}
            onCheckedChange={handleToggleAvailability}
            disabled={toggleMutation.isPending}
          />
          <span className={`text-sm font-semibold ${stats?.availability ? "text-[#2D8A45]" : "text-muted-foreground"}`}>
            {stats?.availability ? "Sim" : "Não"}
          </span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          {
            label: "Receita Total",
            value: formatCurrency(stats?.totalEarnings ?? 0),
            sub: "Pagamentos confirmados",
            icon: <TrendingUp className="h-4 w-4 text-[#C9A961]" />,
          },
          {
            label: "A Receber",
            value: formatCurrency(stats?.pendingEarnings ?? 0),
            sub: "Aguardando confirmação",
            icon: <Clock className="h-4 w-4 text-[#B8860B]" />,
          },
          {
            label: "Taxa de Conclusão",
            value: `${stats?.completionRate ?? 0}%`,
            sub: `${stats?.totalOrders ?? 0} pedidos no total`,
            icon: <CheckCircle2 className="h-4 w-4 text-[#2D8A45]" />,
          },
          {
            label: "Avaliação",
            value: `${Number(stats?.rating ?? 0).toFixed(1)} / 5`,
            sub: `${stats?.totalReviews ?? 0} avaliações`,
            icon: <Star className="h-4 w-4 text-[#C9A961]" />,
          },
        ].map((card) => (
          <Card
            key={card.label}
            className="bg-card border-border"
            style={{ borderRadius: "4px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-[0.5px] text-muted-foreground">
                {card.label}
              </CardTitle>
              {card.icon}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{card.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Orders by status */}
      {stats?.ordersByStatus && stats.ordersByStatus.length > 0 && (
        <Card
          className="bg-card border-border"
          style={{ borderRadius: "4px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
        >
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Pedidos por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {stats.ordersByStatus.map((s) => (
                <div
                  key={s.status}
                  className="flex items-center gap-3 border border-border bg-muted/50 px-4 py-2"
                  style={{ borderRadius: "2px" }}
                >
                  <StatusBadge status={s.status} />
                  <span className="text-2xl font-bold text-foreground">{s.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Earnings chart */}
      {chartData.length > 0 && (
        <Card
          className="bg-card border-border"
          style={{ borderRadius: "4px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
        >
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Ganhos Mensais</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorGanhos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#C9A961" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#C9A961" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v}`} className="text-muted-foreground" />
                <Tooltip
                  formatter={(v: number) => formatCurrency(v)}
                  contentStyle={{ borderRadius: "2px", border: "1px solid var(--border)", fontSize: "12px", background: "var(--card)" }}
                />
                <Area
                  type="monotone"
                  dataKey="ganhos"
                  stroke="#C9A961"
                  fill="url(#colorGanhos)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Recent orders */}
      <Card
        className="bg-card border-border"
        style={{ borderRadius: "4px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
      >
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold">Pedidos Recentes</CardTitle>
          <Link href="/orders">
            <Button
              variant="ghost"
              size="sm"
              className="text-[#C9A961] hover:text-[#B8860B] hover:bg-transparent text-xs font-semibold uppercase tracking-[0.5px]"
            >
              Ver todos <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {recentLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-3">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-6 w-24" />
                </div>
              ))}
            </div>
          ) : !recentData?.orders || recentData.orders.length === 0 ? (
            <EmptyState
              icon={ListOrdered}
              title="Nenhum pedido ainda"
              description="Compartilhe seu perfil público para receber seus primeiros pedidos."
            />
          ) : (
            <div className="divide-y divide-border">
              {recentData.orders.map((order) => (
                <Link key={order.id} href={`/orders/${order.id}`}>
                  <div className="flex items-center justify-between py-3 hover:bg-muted/50 px-2 -mx-2 transition-colors duration-150 cursor-pointer">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate text-foreground">{order.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {order.clientName} ·{" "}
                        {order.daysRemaining > 0
                          ? `${order.daysRemaining} dias restantes`
                          : "Prazo vencido"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      {order.daysRemaining <= 2 && order.daysRemaining > 0 && (
                        <AlertCircle className="h-3.5 w-3.5 text-[#B8860B] shrink-0" />
                      )}
                      <StatusBadge status={order.status} />
                      <span className="text-sm font-bold shrink-0 text-foreground">
                        {formatCurrency(order.basePrice)}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}