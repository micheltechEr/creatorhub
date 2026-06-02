import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import {
  Wallet as WalletIcon,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  CheckCircle2,
  XCircle,
  CreditCard,
  Settings,
  AlertCircle,
  TrendingUp,
  Lock,
} from "lucide-react";
import { toast } from "sonner";

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface WalletData {
  availableBalance: number;
  pendingBalance: number;
  totalEarned: number;
  totalWithdrawn: number;
}

interface WalletTransaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  description: string | null;
  availableAt: string;
  createdAt: string;
}

interface PayoutSettings {
  configured: boolean;
  pixKeyType?: string;
  pixKeyMasked?: string;
}

interface Withdrawal {
  id: string;
  amount: number;
  status: string;
  failureReason: string | null;
  createdAt: string;
}

// ─── Hooks ───────────────────────────────────────────────────────────────────
function useWallet() {
  return useQuery<WalletData>({
    queryKey: ["/wallet"],
    queryFn: () => api.get<WalletData>("/wallet"),
  });
}

function useTransactions() {
  return useQuery<{ wallet: WalletData; transactions: WalletTransaction[] }>({
    queryKey: ["/wallet/transactions"],
    queryFn: () => api.get<{ wallet: WalletData; transactions: WalletTransaction[] }>("/wallet/transactions?limit=100"),
  });
}

function usePayoutSettings() {
  return useQuery<PayoutSettings>({
    queryKey: ["/wallet/payout-settings"],
    queryFn: () => api.get<PayoutSettings>("/wallet/payout-settings"),
  });
}

function useWithdrawals() {
  return useQuery<Withdrawal[]>({
    queryKey: ["/wallet/withdrawals"],
    queryFn: () => api.get<Withdrawal[]>("/wallet/withdrawals"),
  });
}

// ─── Componentes ─────────────────────────────────────────────────────────────

function WalletSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <SkeletonCard />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    AVAILABLE: { label: "Disponível", variant: "default" },
    PENDING_SECURITY: { label: "Em análise", variant: "secondary" },
    SETTLED: { label: "Processado", variant: "default" },
    PENDING: { label: "Pendente", variant: "secondary" },
    PROCESSING: { label: "Processando", variant: "secondary" },
    COMPLETED: { label: "Concluído", variant: "default" },
    FAILED: { label: "Falhou", variant: "destructive" },
    CREDIT: { label: "Crédito", variant: "default" },
    DEBIT: { label: "Débito", variant: "destructive" },
    WITHDRAWAL: { label: "Saque", variant: "secondary" },
  };

  const cfg = map[status] ?? { label: status, variant: "outline" as const };

  return (
    <Badge
      variant={cfg.variant}
      className="text-[11px] uppercase tracking-wide font-semibold"
      style={{ borderRadius: "2px" }}
    >
      {cfg.label}
    </Badge>
  );
}

function TransactionIcon({ type }: { type: string }) {
  switch (type) {
    case "CREDIT":
      return <ArrowDownLeft className="h-4 w-4 text-green-500" />;
    case "WITHDRAWAL":
    case "DEBIT":
      return <ArrowUpRight className="h-4 w-4 text-red-500" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
}

// ─── Modal: Configurar PIX ───────────────────────────────────────────────────
function PixSettingsModal({
  open,
  onOpenChange,
  currentSettings,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentSettings: PayoutSettings | undefined;
}) {
  const queryClient = useQueryClient();
  const [pixKeyType, setPixKeyType] = useState(currentSettings?.pixKeyType ?? "CPF");
  const [pixKey, setPixKey] = useState("");

  const mutation = useMutation({
    mutationFn: (data: { pixKey: string; pixKeyType: string }) =>
      api.put<PayoutSettings>("/wallet/payout-settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/wallet/payout-settings"] });
      toast.success("Configurações de saque atualizadas");
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error ?? "Erro ao salvar configurações");
    },
  });

  const handleSubmit = () => {
    if (!pixKey.trim()) {
      toast.error("Informe a chave PIX");
      return;
    }
    mutation.mutate({ pixKey: pixKey.trim(), pixKeyType });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configurar Saque PIX</DialogTitle>
          <DialogDescription>
            Configure a chave PIX para receber seus saques.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {currentSettings?.configured && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
              <span>
                Chave atual: <strong>{currentSettings.pixKeyType}</strong> — {currentSettings.pixKeyMasked}
              </span>
            </div>
          )}

          <div className="space-y-2">
            <Label>Tipo de Chave PIX</Label>
            <Select value={pixKeyType} onValueChange={setPixKeyType}>
              <SelectTrigger style={{ borderRadius: "2px" }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CPF">CPF</SelectItem>
                <SelectItem value="CNPJ">CNPJ</SelectItem>
                <SelectItem value="EMAIL">E-mail</SelectItem>
                <SelectItem value="PHONE">Telefone</SelectItem>
                <SelectItem value="EVP">Chave Aleatória (EVP)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>
              {pixKeyType === "CPF"
                ? "CPF (somente números)"
                : pixKeyType === "CNPJ"
                  ? "CNPJ (somente números)"
                  : pixKeyType === "EMAIL"
                    ? "E-mail"
                    : pixKeyType === "PHONE"
                      ? "Telefone (com DDD)"
                      : "Chave Aleatória"}
            </Label>
            <Input
              placeholder={
                pixKeyType === "CPF"
                  ? "000.000.000-00"
                  : pixKeyType === "CNPJ"
                    ? "00.000.000/0000-00"
                    : pixKeyType === "EMAIL"
                      ? "seu@email.com"
                      : pixKeyType === "PHONE"
                        ? "+5511999999999"
                        : "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              }
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
              style={{ borderRadius: "2px" }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            style={{ borderRadius: "2px" }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={mutation.isPending}
            style={{ borderRadius: "2px" }}
          >
            {mutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Modal: Solicitar Saque ──────────────────────────────────────────────────
function WithdrawModal({
  open,
  onOpenChange,
  availableBalance,
  payoutSettings,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  availableBalance: number;
  payoutSettings: PayoutSettings | undefined;
}) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");

  const amountCents = Math.round(parseFloat(amount || "0") * 100);
  const isValid = amountCents >= 5000 && amountCents <= availableBalance;

  const mutation = useMutation({
    mutationFn: () =>
      api.post<{ success: boolean; withdrawalId: string }>("/wallet/withdraw", { amount: amountCents }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/wallet/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/wallet/withdrawals"] });
      toast.success("Saque solicitado com sucesso!");
      onOpenChange(false);
      setAmount("");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error ?? "Erro ao solicitar saque");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Solicitar Saque</DialogTitle>
          <DialogDescription>
            Valor disponível: <strong>{formatCurrency(availableBalance)}</strong>
          </DialogDescription>
        </DialogHeader>

        {!payoutSettings?.configured ? (
          <div className="flex items-center gap-2 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded text-sm">
            <AlertCircle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
            <span>Configure sua chave PIX primeiro nas configurações de saque.</span>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                min={50}
                max={availableBalance / 100}
                step={0.01}
                placeholder="50.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{ borderRadius: "2px" }}
              />
              <p className="text-xs text-muted-foreground">
                Mínimo: R$ 50,00 · PIX: {payoutSettings.pixKeyType} — {payoutSettings.pixKeyMasked}
              </p>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                style={{ borderRadius: "2px" }}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => mutation.mutate()}
                disabled={!isValid || mutation.isPending}
                style={{ borderRadius: "2px" }}
              >
                {mutation.isPending ? "Processando..." : "Solicitar Saque"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Página Principal ────────────────────────────────────────────────────────
export default function WalletPage() {
  const { data: wallet, isLoading } = useWallet();
  const { data: txData } = useTransactions();
  const { data: payoutSettings } = usePayoutSettings();
  const { data: withdrawals } = useWithdrawals();

  const [pixModalOpen, setPixModalOpen] = useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);

  if (isLoading) return <WalletSkeleton />;

  return (
    <div className="space-y-8">
      <Breadcrumb
        items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Financeiro" }]}
      />

      <div>
        <h1 className="text-2xl font-serif font-semibold tracking-tight">Financeiro</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie seus ganhos, saques e configurações de pagamento.
        </p>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card style={{ borderRadius: "2px" }}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Disponível
              </span>
              <WalletIcon className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-2xl font-semibold text-foreground">
              {formatCurrency(wallet?.availableBalance ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Pronto para saque</p>
          </CardContent>
        </Card>

        <Card style={{ borderRadius: "2px" }}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Em Análise
              </span>
              <Lock className="h-4 w-4 text-yellow-500" />
            </div>
            <p className="text-2xl font-semibold text-foreground">
              {formatCurrency(wallet?.pendingBalance ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Período de segurança (7 dias)</p>
          </CardContent>
        </Card>

        <Card style={{ borderRadius: "2px" }}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Total Ganho
              </span>
              <TrendingUp className="h-4 w-4 text-blue-500" />
            </div>
            <p className="text-2xl font-semibold text-foreground">
              {formatCurrency(wallet?.totalEarned ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Acumulado histórico</p>
          </CardContent>
        </Card>

        <Card style={{ borderRadius: "2px" }}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Total Sacado
              </span>
              <ArrowUpRight className="h-4 w-4 text-purple-500" />
            </div>
            <p className="text-2xl font-semibold text-foreground">
              {formatCurrency(wallet?.totalWithdrawn ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Já transferido</p>
          </CardContent>
        </Card>
      </div>

      {/* Ações */}
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => setWithdrawModalOpen(true)}
          className="bg-[#C9A961] text-[#0A0A0A] hover:bg-[#B8964F] font-semibold"
          style={{ borderRadius: "2px" }}
        >
          <ArrowUpRight className="h-4 w-4 mr-2" />
          Solicitar Saque
        </Button>
        <Button
          variant="outline"
          onClick={() => setPixModalOpen(true)}
          style={{ borderRadius: "2px" }}
        >
          <Settings className="h-4 w-4 mr-2" />
          {payoutSettings?.configured ? "Alterar Chave PIX" : "Configurar PIX"}
        </Button>
      </div>

      {/* Status PIX */}
      {payoutSettings?.configured && (
        <Card style={{ borderRadius: "2px" }}>
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
            <div className="text-sm">
              <span className="font-medium">Chave PIX configurada: </span>
              <span className="text-muted-foreground">
                {payoutSettings.pixKeyType} — {payoutSettings.pixKeyMasked}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transações */}
      <Card style={{ borderRadius: "2px" }}>
        <CardHeader>
          <CardTitle className="text-lg">Transações</CardTitle>
          <CardDescription>Histórico de créditos e débitos</CardDescription>
        </CardHeader>
        <CardContent>
          {!txData?.transactions?.length ? (
            <div className="text-center py-8">
              <WalletIcon className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma transação ainda.</p>
            </div>
          ) : (
            <div className="space-y-0 divide-y divide-border">
              {txData.transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <TransactionIcon type={tx.type} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {tx.description ?? tx.type}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(tx.createdAt).toLocaleDateString("pt-BR")}
                        {tx.status === "PENDING_SECURITY" && (
                          <span className="ml-2">
                            · Libera em {new Date(tx.availableAt).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <StatusBadge status={tx.status} />
                    <span
                      className={`text-sm font-semibold ${
                        tx.amount >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {tx.amount >= 0 ? "+" : ""}
                      {formatCurrency(Math.abs(tx.amount))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Saques */}
      {withdrawals && withdrawals.length > 0 && (
        <Card style={{ borderRadius: "2px" }}>
          <CardHeader>
            <CardTitle className="text-lg">Saques</CardTitle>
            <CardDescription>Histórico de solicitações de saque</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-0 divide-y divide-border">
              {withdrawals.map((w) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <ArrowUpRight className="h-4 w-4 text-purple-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Saque PIX</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(w.createdAt).toLocaleDateString("pt-BR")}
                        {w.failureReason && (
                          <span className="text-red-500 ml-2">· {w.failureReason}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <StatusBadge status={w.status} />
                    <span className="text-sm font-semibold">
                      {formatCurrency(w.amount)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modals */}
      <PixSettingsModal
        open={pixModalOpen}
        onOpenChange={setPixModalOpen}
        currentSettings={payoutSettings}
      />
      <WithdrawModal
        open={withdrawModalOpen}
        onOpenChange={setWithdrawModalOpen}
        availableBalance={wallet?.availableBalance ?? 0}
        payoutSettings={payoutSettings}
      />
    </div>
  );
}