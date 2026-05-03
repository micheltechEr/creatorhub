import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { Users, ListOrdered, DollarSign, UserCheck, TrendingUp, Clock } from "lucide-react";
import { Link } from "wouter";

interface AdminStats {
  totalArtists: number;
  activeArtists: number;
  suspendedArtists: number;
  totalOrders: number;
  ordersByStatus: { status: string; count: number }[];
  totalRevenue: number;
  totalClients: number;
  recentArtists: {
    id: string;
    name: string;
    email: string;
    createdAt: string;
    isActive: boolean;
  }[];
}

const STATUS_LABEL: Record<string, string> = {
  PROPOSED: "Proposto",
  PAYMENT_PENDING: "Ag. Pagamento",
  PAID: "Pago",
  IN_PROGRESS: "Em Andamento",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelado",
};

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accent,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  accent?: boolean;
}) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">
              {title}
            </p>
            <p
              className={`text-3xl font-bold ${accent ? "text-[#C9A961]" : "text-foreground"}`}
            >
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          <div
            className={`p-2.5 rounded ${accent ? "bg-[#C9A961]/10" : "bg-muted"}`}
            style={{ borderRadius: "2px" }}
          >
            <Icon
              className={`h-5 w-5 ${accent ? "text-[#C9A961]" : "text-muted-foreground"}`}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const { data: stats, isLoading } = useQuery<AdminStats>({
    queryKey: ["admin", "stats"],
    queryFn: () => api.get<AdminStats>("/admin/stats"),
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-[#C9A961] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const deliveredCount = stats?.ordersByStatus.find((s) => s.status === "DELIVERED")?.count ?? 0;
  const activeCount =
    (stats?.ordersByStatus.find((s) => s.status === "PAID")?.count ?? 0) +
    (stats?.ordersByStatus.find((s) => s.status === "IN_PROGRESS")?.count ?? 0);

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl font-semibold text-foreground mb-1">
          Painel Administrativo
        </h1>
        <p className="text-sm text-muted-foreground">
          Visão geral da plataforma CREATOR HUB
        </p>
        <div className="mt-2 h-px w-12 bg-[#C9A961]" />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total de Artistas"
          value={stats?.totalArtists ?? 0}
          subtitle={`${stats?.activeArtists ?? 0} ativos · ${stats?.suspendedArtists ?? 0} suspensos`}
          icon={Users}
        />
        <StatCard
          title="Total de Pedidos"
          value={stats?.totalOrders ?? 0}
          subtitle={`${deliveredCount} entregues · ${activeCount} em andamento`}
          icon={ListOrdered}
        />
        <StatCard
          title="Receita Confirmada"
          value={formatCurrency(stats?.totalRevenue ?? 0)}
          subtitle="Pagamentos confirmados"
          icon={DollarSign}
          accent
        />
        <StatCard
          title="Total de Clientes"
          value={stats?.totalClients ?? 0}
          subtitle="Únicos na plataforma"
          icon={UserCheck}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Orders by status */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#C9A961]" />
              Pedidos por Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(stats?.ordersByStatus ?? []).map((s) => (
              <div key={s.status} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {STATUS_LABEL[s.status] ?? s.status}
                </span>
                <span className="text-sm font-semibold text-foreground">{s.count}</span>
              </div>
            ))}
            {!stats?.ordersByStatus?.length && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum pedido ainda
              </p>
            )}
          </CardContent>
        </Card>

        {/* Recent artists */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#C9A961]" />
                Artistas Recentes
              </CardTitle>
              <Link href="/admin/artists">
                <span className="text-xs text-[#C9A961] hover:underline cursor-pointer">
                  Ver todos →
                </span>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {(stats?.recentArtists ?? []).map((a) => (
              <div key={a.id} className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{a.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{a.email}</p>
                </div>
                <Badge
                  variant="outline"
                  className={
                    a.isActive
                      ? "border-green-700 text-green-400 bg-green-950/30 text-[10px]"
                      : "border-red-700 text-red-400 bg-red-950/30 text-[10px]"
                  }
                >
                  {a.isActive ? "Ativo" : "Suspenso"}
                </Badge>
              </div>
            ))}
            {!stats?.recentArtists?.length && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum artista cadastrado
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
