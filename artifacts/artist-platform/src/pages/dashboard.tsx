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
import {
  TrendingUp,
  Clock,
  CheckCircle2,
  Star,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

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

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats({
    query: { queryKey: getGetDashboardStatsQueryKey() },
  });
  const { data: recentData } = useGetRecentOrders({
    query: { queryKey: getGetRecentOrdersQueryKey() },
  });
  const { data: earningsData } = useGetEarnings({
    query: { queryKey: getGetEarningsQueryKey() },
  });
  const toggleMutation = useToggleAvailability();

  const handleToggleAvailability = async () => {
    try {
      await toggleMutation.mutateAsync({
        data: { availability: !stats?.availability },
      });
      queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
      toast.success(
        stats?.availability ? "Disponibilidade desativada" : "Disponibilidade ativada"
      );
    } catch {
      toast.error("Erro ao atualizar disponibilidade");
    }
  };

  const chartData =
    earningsData?.monthly?.map((m) => ({
      name: `${m.month}/${m.year}`,
      ganhos: m.earnings,
      pedidos: m.orderCount,
    })) ?? [];

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground animate-pulse">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Visao geral da sua atividade</p>
        </div>
        <div className="flex items-center gap-3 bg-card border border-border rounded-2xl px-4 py-3 shadow-sm">
          <span className="text-sm font-medium text-muted-foreground">Disponivel</span>
          <Switch
            checked={stats?.availability ?? false}
            onCheckedChange={handleToggleAvailability}
            disabled={toggleMutation.isPending}
          />
          <span
            className={`text-sm font-semibold ${stats?.availability ? "text-green-600" : "text-muted-foreground"}`}
          >
            {stats?.availability ? "Sim" : "Nao"}
          </span>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-border/70 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Receita Total
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats?.totalEarnings ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Pagamentos confirmados</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/70 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              A Receber
            </CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats?.pendingEarnings ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Aguardando confirmacao</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/70 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Taxa de Conclusao
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.completionRate ?? 0}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.totalOrders ?? 0} pedidos no total
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/70 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avaliacao
            </CardTitle>
            <Star className="h-4 w-4 text-yellow-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Number(stats?.rating ?? 0).toFixed(1)}{" "}
              <span className="text-base font-normal text-muted-foreground">/ 5</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.totalReviews ?? 0} avaliacoes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Orders by status */}
      {stats?.ordersByStatus && stats.ordersByStatus.length > 0 && (
        <Card className="rounded-2xl border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Pedidos por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {stats.ordersByStatus.map((s) => (
                <div
                  key={s.status}
                  className="flex items-center gap-2 border border-border rounded-lg px-4 py-2"
                >
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[s.status] ?? "bg-gray-100 text-gray-700"}`}
                  >
                    {STATUS_LABELS[s.status] ?? s.status}
                  </span>
                  <span className="text-2xl font-bold">{s.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Earnings chart */}
      {chartData.length > 0 && (
        <Card className="rounded-2xl border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Ganhos Mensais</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorGanhos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(267 100% 64%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(267 100% 64%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `R$${v}`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Area
                  type="monotone"
                  dataKey="ganhos"
                  stroke="hsl(267 100% 64%)"
                  fill="url(#colorGanhos)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Recent orders */}
      <Card className="rounded-2xl border-border/70 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">Pedidos Recentes</CardTitle>
          <Link href="/orders">
            <Button variant="ghost" size="sm" className="text-primary">
              Ver todos <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {!recentData?.orders || recentData.orders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum pedido ainda. Compartilhe seu perfil para comecar!
            </div>
          ) : (
            <div className="space-y-3">
              {recentData.orders.map((order) => (
                <Link key={order.id} href={`/orders/${order.id}`}>
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/30 transition-colors cursor-pointer">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{order.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {order.clientName} ·{" "}
                        {order.daysRemaining > 0
                          ? `${order.daysRemaining} dias restantes`
                          : "Prazo vencido"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      {order.daysRemaining <= 2 && order.daysRemaining > 0 && (
                        <AlertCircle className="h-4 w-4 text-yellow-500 shrink-0" />
                      )}
                      <Badge
                        className={`text-xs shrink-0 ${STATUS_COLORS[order.status] ?? ""}`}
                        variant="outline"
                      >
                        {STATUS_LABELS[order.status] ?? order.status}
                      </Badge>
                      <span className="text-sm font-semibold shrink-0">
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
