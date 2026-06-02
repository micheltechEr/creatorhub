import { useState } from "react";
import {
  useGetMe,
  getGetMeQueryKey,
  useUpdateMe,
  useToggleAvailability,
  ConnectAsaasButton as _ConnectAsaasButton,
} from "@workspace/api-client-react";

// Workaround: @types/react version mismatch between workspace packages
const ConnectAsaasButton = _ConnectAsaasButton as unknown as React.ComponentType<{ onConnected?: (walletId: string) => void }>;
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { formatCurrency } from "@/lib/format";
import { Textarea } from "@/components/ui/textarea";
import { X, Star, Pencil, Check, ExternalLink, Copy } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = [
  "Música", "Dança", "Comédia", "Motivação",
  "Aniversário", "Casamento", "Outro",
];

const cardStyle = {
  borderRadius: "4px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
};

const inputStyle = {
  borderRadius: "2px",
};

export default function Profile() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [tagInput, setTagInput] = useState("");

  const { data: artist, isLoading } = useGetMe({
    query: { queryKey: getGetMeQueryKey() },
  });
  const updateMutation = useUpdateMe();
  const toggleMutation = useToggleAvailability();

  const [formData, setFormData] = useState({
    name: "",
    bio: "",
    categories: [] as string[],
    tags: [] as string[],
    basePrice: 0,
    deliveryDays: 7,
  });

  const startEdit = () => {
    if (artist) {
      setFormData({
        name: artist.name,
        bio: (artist as any).bio ?? "",
        categories: artist.categories,
        tags: artist.tags,
        basePrice: artist.basePrice,
        deliveryDays: artist.deliveryDays,
      });
    }
    setEditing(true);
  };

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({ data: formData });
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      toast.success("Perfil atualizado com sucesso!");
      setEditing(false);
    } catch {
      toast.error("Erro ao atualizar perfil");
    }
  };

  const handleToggleAvailability = async () => {
    try {
      await toggleMutation.mutateAsync({ data: { availability: !artist?.availability } });
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      toast.success(
        artist?.availability ? "Você está indisponível agora" : "Você está disponível agora"
      );
    } catch {
      toast.error("Erro ao atualizar disponibilidade");
    }
  };

  const toggleCategory = (cat: string) => {
    setFormData((prev) => ({
      ...prev,
      categories: prev.categories.includes(cat)
        ? prev.categories.filter((c) => c !== cat)
        : [...prev.categories, cat],
    }));
  };

  const addTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      if (!formData.tags.includes(tagInput.trim())) {
        setFormData((prev) => ({ ...prev, tags: [...prev.tags, tagInput.trim()] }));
      }
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    setFormData((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tag) }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground text-sm">Carregando perfil...</div>
      </div>
    );
  }

  if (!artist) return null;

  const publicUrl = `/p/${artist.id}`;
  const copyPublicLink = () => {
    const fullUrl = `${window.location.origin}${publicUrl}`;
    navigator.clipboard.writeText(fullUrl);
    toast.success("Link copiado!");
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-serif text-4xl font-semibold text-foreground">Meu Perfil</h1>
          <p className="text-sm text-muted-foreground mt-1 uppercase tracking-[0.3px]">
            Gerencie suas informações e configurações
          </p>
        </div>
        {!editing ? (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={copyPublicLink}
              className="text-sm border-border font-semibold"
              style={{ borderRadius: "2px" }}
            >
              <Copy className="mr-2 h-3.5 w-3.5" /> Copiar Link Público
            </Button>
            <Button
              onClick={startEdit}
              className="bg-foreground text-background hover:opacity-90 text-sm font-semibold"
              style={{ borderRadius: "2px" }}
            >
              <Pencil className="mr-2 h-3.5 w-3.5" /> Editar Perfil
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setEditing(false)}
              className="text-sm border-border"
              style={{ borderRadius: "2px" }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="bg-foreground text-background hover:opacity-90 text-sm font-semibold"
              style={{ borderRadius: "2px" }}
            >
              <Check className="mr-2 h-3.5 w-3.5" />
              {updateMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            top: (
              <div className="flex items-center justify-center gap-1.5">
                <Star className="h-4 w-4 text-[#C9A961] fill-[#C9A961]" />
                <span className="text-2xl font-bold">{Number(artist.rating).toFixed(1)}</span>
              </div>
            ),
            sub: `${artist.totalReviews} avaliações`,
          },
          {
            top: <p className="text-2xl font-bold">{formatCurrency(artist.basePrice)}</p>,
            sub: "Preço base",
          },
          {
            top: <p className="text-2xl font-bold">{artist.deliveryDays}d</p>,
            sub: "Prazo de entrega",
          },
        ].map((stat, i) => (
          <div
            key={i}
            className="bg-card border border-border p-4 text-center"
            style={cardStyle}
          >
            <div className="mb-0.5">{stat.top}</div>
            <p className="text-xs text-muted-foreground uppercase tracking-[0.3px]">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Availability */}
      <div
        className="bg-card border border-border p-5 flex items-center justify-between"
        style={cardStyle}
      >
        <div>
          <p className="text-sm font-semibold text-foreground">Disponibilidade</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {artist.availability
              ? "Você está recebendo novos pedidos"
              : "Você não está recebendo novos pedidos"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`text-xs font-semibold uppercase tracking-[0.5px] ${
              artist.availability ? "text-[#2D8A45]" : "text-muted-foreground"
            }`}
          >
            {artist.availability ? "Disponível" : "Indisponível"}
          </span>
          <Switch
            checked={artist.availability}
            onCheckedChange={handleToggleAvailability}
            disabled={toggleMutation.isPending}
          />
        </div>
      </div>

      {/* Public link */}
      <div
        className="bg-card border border-[#C9A961]/30 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
        style={cardStyle}
      >
        <div>
          <p className="text-sm font-semibold text-foreground">Seu Link Público</p>
          <p className="text-xs text-muted-foreground mt-0.5 font-mono break-all">
            {window.location.origin}{publicUrl}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={copyPublicLink}
            className="text-xs border-border font-semibold"
            style={{ borderRadius: "2px" }}
          >
            <Copy className="mr-1.5 h-3 w-3" /> Copiar
          </Button>
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button
              variant="outline"
              size="sm"
              className="text-xs border-border font-semibold"
              style={{ borderRadius: "2px" }}
            >
              <ExternalLink className="mr-1.5 h-3 w-3" /> Visualizar
            </Button>
          </a>
        </div>
      </div>

      {/* Asaas Connect */}
      <div
        className="bg-card border border-border p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
        style={cardStyle}
      >
        <div>
          <p className="text-sm font-semibold text-foreground">Pagamentos (Asaas)</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Conecte sua conta Asaas para receber pagamentos dos pedidos
          </p>
        </div>
        <ConnectAsaasButton
          onConnected={(walletId) => toast.success(`Asaas conectado! Wallet: ${walletId}`)}
        />
      </div>

      {/* Profile info */}
      <div className="bg-card border border-border" style={cardStyle}>
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Informações do Perfil</h3>
        </div>
        <div className="p-6 space-y-6">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium uppercase tracking-[0.5px] text-foreground">
              Nome artístico
            </Label>
            {editing ? (
              <Input
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                className="h-12 text-sm border-border"
                style={inputStyle}
              />
            ) : (
              <p className="text-sm font-medium text-foreground">{artist.name}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium uppercase tracking-[0.5px] text-foreground">
              Bio / Apresentação
            </Label>
            {editing ? (
              <Textarea
                value={formData.bio}
                onChange={(e) => setFormData((p) => ({ ...p, bio: e.target.value }))}
                placeholder="Fale sobre você, seu estilo, experiência..."
                rows={4}
                className="text-sm border-border resize-none"
                style={inputStyle}
              />
            ) : (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {(artist as any).bio || <span className="italic">Nenhuma bio adicionada</span>}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium uppercase tracking-[0.5px] text-foreground">
              E-mail
            </Label>
            <p className="text-sm text-muted-foreground">{artist.email}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-[0.5px] text-foreground">
                Preço Base (BRL)
              </Label>
              {editing ? (
                <div className="relative">
                  <span className="absolute left-3 top-3 text-muted-foreground text-sm">R$</span>
                  <Input
                    type="number"
                    className="h-12 pl-9 text-sm border-border"
                    style={inputStyle}
                    value={formData.basePrice}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, basePrice: Number(e.target.value) }))
                    }
                  />
                </div>
              ) : (
                <p className="text-sm font-medium text-foreground">{formatCurrency(artist.basePrice)}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-[0.5px] text-foreground">
                Prazo de Entrega (dias)
              </Label>
              {editing ? (
                <Input
                  type="number"
                  className="h-12 text-sm border-border"
                  style={inputStyle}
                  value={formData.deliveryDays}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, deliveryDays: Number(e.target.value) }))
                  }
                />
              ) : (
                <p className="text-sm font-medium text-foreground">{artist.deliveryDays} dias</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium uppercase tracking-[0.5px] text-foreground">
              Categorias
            </Label>
            {editing ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className={`p-2.5 border text-xs font-medium transition-colors duration-150 ${
                      formData.categories.includes(cat)
                        ? "bg-foreground text-background border-foreground"
                        : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                    style={{ borderRadius: "2px" }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {artist.categories.map((cat) => (
                  <span
                    key={cat}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-medium bg-muted text-foreground"
                    style={{ borderRadius: "2px" }}
                  >
                    {cat}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium uppercase tracking-[0.5px] text-foreground">
              Tags
            </Label>
            {editing ? (
              <>
                <Input
                  placeholder="Pressione Enter para adicionar tag..."
                  value={tagInput}
                  className="h-12 text-sm border-border"
                  style={inputStyle}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={addTag}
                />
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-foreground text-background"
                      style={{ borderRadius: "2px" }}
                    >
                      {tag}
                      <button type="button" onClick={() => removeTag(tag)} className="hover:opacity-70">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-wrap gap-2">
                {artist.tags.length > 0 ? (
                  artist.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-3 py-1.5 text-xs font-medium border border-border text-muted-foreground"
                      style={{ borderRadius: "2px" }}
                    >
                      {tag}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">Nenhuma tag adicionada</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
