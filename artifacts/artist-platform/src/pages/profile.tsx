import { useState } from "react";
import {
  useGetMe,
  getGetMeQueryKey,
  useUpdateMe,
  useToggleAvailability,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { formatCurrency } from "@/lib/format";
import { X, Plus, Star, Pencil, Check } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";

const CATEGORIES = [
  "Musica",
  "Danca",
  "Comedia",
  "Motivacao",
  "Aniversario",
  "Casamento",
  "Outro",
];

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
    categories: [] as string[],
    tags: [] as string[],
    basePrice: 0,
    deliveryDays: 7,
  });

  const startEdit = () => {
    if (artist) {
      setFormData({
        name: artist.name,
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
      toast.success(artist?.availability ? "Voce esta indisponivel agora" : "Voce esta disponivel agora");
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
        <div className="animate-pulse text-muted-foreground">Carregando perfil...</div>
      </div>
    );
  }

  if (!artist) return null;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Meu Perfil</h1>
          <p className="text-muted-foreground mt-1">Gerencie suas informacoes e configuracoes</p>
        </div>
        {!editing ? (
          <Button onClick={startEdit}>
            <Pencil className="mr-2 h-4 w-4" /> Editar Perfil
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              <Check className="mr-2 h-4 w-4" />
              {updateMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        )}
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="rounded-2xl border-border/70 shadow-sm">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Star className="h-4 w-4 text-yellow-400" />
              <span className="text-2xl font-bold">{Number(artist.rating).toFixed(1)}</span>
            </div>
            <p className="text-xs text-muted-foreground">{artist.totalReviews} avaliacoes</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/70 shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{formatCurrency(artist.basePrice)}</p>
            <p className="text-xs text-muted-foreground">Preco base</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/70 shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{artist.deliveryDays}d</p>
            <p className="text-xs text-muted-foreground">Prazo de entrega</p>
          </CardContent>
        </Card>
      </div>

      {/* Availability */}
      <Card className="rounded-2xl border-border/70 shadow-sm">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="font-semibold">Disponibilidade</p>
            <p className="text-sm text-muted-foreground">
              {artist.availability
                ? "Voce esta recebendo novos pedidos"
                : "Voce nao esta recebendo novos pedidos"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-sm font-medium ${artist.availability ? "text-green-600" : "text-muted-foreground"}`}>
              {artist.availability ? "Disponivel" : "Indisponivel"}
            </span>
            <Switch
              checked={artist.availability}
              onCheckedChange={handleToggleAvailability}
              disabled={toggleMutation.isPending}
            />
          </div>
        </CardContent>
      </Card>

      {/* Profile info */}
      <Card className="rounded-2xl border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle>Informacoes do Perfil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Nome artistico</Label>
            {editing ? (
                  <Input
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                    className="rounded-xl"
              />
            ) : (
              <p className="font-medium">{artist.name}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <p className="text-muted-foreground">{artist.email}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Preco Base (BRL)</Label>
              {editing ? (
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">R$</span>
                  <Input
                    type="number"
                    className="pl-9 rounded-xl"
                    value={formData.basePrice}
                    onChange={(e) => setFormData((p) => ({ ...p, basePrice: Number(e.target.value) }))}
                  />
                </div>
              ) : (
                <p className="font-medium">{formatCurrency(artist.basePrice)}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Prazo de Entrega (dias)</Label>
              {editing ? (
                <Input
                  type="number"
                  value={formData.deliveryDays}
                  className="rounded-xl"
                  onChange={(e) => setFormData((p) => ({ ...p, deliveryDays: Number(e.target.value) }))}
                />
              ) : (
                <p className="font-medium">{artist.deliveryDays} dias</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Categorias</Label>
            {editing ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className={`p-2 rounded-md border text-sm font-medium transition-colors ${
                      formData.categories.includes(cat)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border hover:bg-accent/30"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {artist.categories.map((cat) => (
                  <Badge key={cat} variant="secondary">{cat}</Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Tags</Label>
            {editing ? (
              <>
                <Input
                  placeholder="Pressione Enter para adicionar tag..."
                  value={tagInput}
                  className="rounded-xl"
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={addTag}
                />
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="px-2 py-1">
                      {tag}
                      <button type="button" onClick={() => removeTag(tag)} className="ml-2">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-wrap gap-2">
                {artist.tags.length > 0 ? (
                  artist.tags.map((tag) => (
                    <Badge key={tag} variant="outline">{tag}</Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">Nenhuma tag adicionada</span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
