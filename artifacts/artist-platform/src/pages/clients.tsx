import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  Search,
  Users,
  Plus,
  X,
  ChevronRight,
  Mail,
  Phone,
  ShoppingBag,
  DollarSign,
} from "lucide-react";
import { toast } from "sonner";

interface TenantClient {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  phone: string | null;
  notes: string | null;
  totalOrders: number;
  totalSpent: number;
  createdAt: string;
  updatedAt: string;
}

interface ClientOrder {
  id: string;
  title: string;
  status: string;
  basePrice: number;
  deadline: string;
  createdAt: string;
}

interface ClientDetail extends TenantClient {
  orders: ClientOrder[];
}

const STATUS_LABEL: Record<string, string> = {
  PROPOSED: "Proposto",
  PAYMENT_PENDING: "Ag. Pagamento",
  PAID: "Pago",
  IN_PROGRESS: "Em Andamento",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelado",
};

function AddClientForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "" });

  const create = useMutation({
    mutationFn: (body: typeof form) => api.post<TenantClient>("/clients", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Cliente adicionado com sucesso");
      onClose();
    },
    onError: (err: any) =>
      toast.error(err.body?.message ?? "Erro ao adicionar cliente"),
  });

  return (
    <Card className="bg-card border-border mb-6">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-foreground text-sm">Novo Cliente</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nome *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="bg-background border-border"
              style={{ borderRadius: "2px" }}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Email *</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="bg-background border-border"
              style={{ borderRadius: "2px" }}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Telefone</Label>
            <Input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="bg-background border-border"
              style={{ borderRadius: "2px" }}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Observações</Label>
            <Input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="bg-background border-border"
              style={{ borderRadius: "2px" }}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            style={{ borderRadius: "2px" }}
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            className="bg-[#C9A961] hover:bg-[#B8964F] text-[#0A0A0A] font-semibold"
            style={{ borderRadius: "2px" }}
            onClick={() => create.mutate(form)}
            disabled={create.isPending || !form.name || !form.email}
          >
            Salvar Cliente
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ClientDetailPanel({
  client,
  onClose,
}: {
  client: TenantClient;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [editNotes, setEditNotes] = useState(client.notes ?? "");
  const [editPhone, setEditPhone] = useState(client.phone ?? "");
  const [editing, setEditing] = useState(false);

  const { data: detail } = useQuery<ClientDetail>({
    queryKey: ["clients", client.id],
    queryFn: () => api.get<ClientDetail>(`/clients/${client.id}`),
  });

  const update = useMutation({
    mutationFn: (body: { phone?: string; notes?: string }) =>
      api.put<TenantClient>(`/clients/${client.id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Cliente atualizado");
      setEditing(false);
    },
    onError: () => toast.error("Erro ao atualizar cliente"),
  });

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50" onClick={onClose} />
      <div className="w-full max-w-md bg-card border-l border-border overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-serif text-xl font-semibold text-foreground">
                {client.name}
              </h2>
              <p className="text-sm text-muted-foreground">{client.email}</p>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground mt-1"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-background p-3" style={{ borderRadius: "2px" }}>
              <div className="flex items-center gap-1.5 mb-1">
                <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Pedidos</span>
              </div>
              <p className="text-xl font-bold text-foreground">{client.totalOrders}</p>
            </div>
            <div className="bg-background p-3" style={{ borderRadius: "2px" }}>
              <div className="flex items-center gap-1.5 mb-1">
                <DollarSign className="h-3.5 w-3.5 text-[#C9A961]" />
                <span className="text-xs text-muted-foreground">Total Gasto</span>
              </div>
              <p className="text-xl font-bold text-[#C9A961]">
                {formatCurrency(client.totalSpent)}
              </p>
            </div>
          </div>

          {/* Contact info */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4 shrink-0" />
              <span>{client.email}</span>
            </div>
            {(editing ? editPhone : client.phone) && !editing && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4 shrink-0" />
                <span>{client.phone}</span>
              </div>
            )}
          </div>

          {/* Edit section */}
          {editing ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Telefone</Label>
                <Input
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="bg-background border-border"
                  style={{ borderRadius: "2px" }}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Observações</Label>
                <Textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={3}
                  className="bg-background border-border resize-none"
                  style={{ borderRadius: "2px" }}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="bg-[#C9A961] hover:bg-[#B8964F] text-[#0A0A0A] font-semibold"
                  style={{ borderRadius: "2px" }}
                  onClick={() => update.mutate({ phone: editPhone, notes: editNotes })}
                  disabled={update.isPending}
                >
                  Salvar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  style={{ borderRadius: "2px" }}
                  onClick={() => setEditing(false)}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div>
              {client.notes && (
                <p className="text-sm text-muted-foreground italic mb-3">
                  {client.notes}
                </p>
              )}
              <Button
                size="sm"
                variant="outline"
                className="border-border text-muted-foreground hover:text-foreground"
                style={{ borderRadius: "2px" }}
                onClick={() => setEditing(true)}
              >
                Editar informações
              </Button>
            </div>
          )}

          {/* Orders */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
              Histórico de Pedidos
            </h3>
            <div className="space-y-2">
              {(detail?.orders ?? []).map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-3 bg-background"
                  style={{ borderRadius: "2px" }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {order.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(order.createdAt)}
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-xs font-semibold text-[#C9A961]">
                      {formatCurrency(order.basePrice)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {STATUS_LABEL[order.status] ?? order.status}
                    </p>
                  </div>
                </div>
              ))}
              {!detail?.orders?.length && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Nenhum pedido ainda
                </p>
              )}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Cliente desde {formatDate(client.createdAt)}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Clients() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [selectedClient, setSelectedClient] = useState<TenantClient | null>(null);

  const { data, isLoading } = useQuery<{ clients: TenantClient[]; total: number }>({
    queryKey: ["clients"],
    queryFn: () => api.get<{ clients: TenantClient[]; total: number }>("/clients"),
  });

  const filtered = (data?.clients ?? []).filter(
    (c) =>
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-foreground mb-1">
            Meus Clientes
          </h1>
          <p className="text-sm text-muted-foreground">
            {data?.total ?? 0} clientes cadastrados
          </p>
          <div className="mt-2 h-px w-12 bg-[#C9A961]" />
        </div>
        <Button
          className="bg-[#C9A961] hover:bg-[#B8964F] text-[#0A0A0A] font-semibold"
          style={{ borderRadius: "2px" }}
          onClick={() => setShowAdd(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Cliente
        </Button>
      </div>

      {/* Add form */}
      {showAdd && <AddClientForm onClose={() => setShowAdd(false)} />}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-card border-border"
          style={{ borderRadius: "2px" }}
        />
      </div>

      {/* Client list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#C9A961] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((client) => (
            <Card
              key={client.id}
              className="bg-card border-border hover:border-[#C9A961]/30 transition-colors cursor-pointer"
              onClick={() => setSelectedClient(client)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">{client.name}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {client.email}
                      </span>
                      {client.phone && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {client.phone}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0 ml-4">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-muted-foreground">
                        {client.totalOrders}{" "}
                        {client.totalOrders === 1 ? "pedido" : "pedidos"}
                      </p>
                      <p className="text-sm font-semibold text-[#C9A961]">
                        {formatCurrency(client.totalSpent)}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhum cliente encontrado</p>
              {!search && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3 text-[#C9A961] hover:text-[#B8964F]"
                  onClick={() => setShowAdd(true)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar primeiro cliente
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Detail panel */}
      {selectedClient && (
        <ClientDetailPanel
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
        />
      )}
    </div>
  );
}
