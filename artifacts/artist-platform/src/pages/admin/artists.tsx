import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";
import { Search, ShieldOff, ShieldCheck, Trash2, Star, Users } from "lucide-react";
import { toast } from "sonner";

interface Artist {
  id: string;
  name: string;
  email: string;
  categories: string[];
  basePrice: number;
  availability: boolean;
  rating: number;
  totalReviews: number;
  isActive: boolean;
  suspendedAt: string | null;
  suspendedReason: string | null;
  createdAt: string;
}

interface ArtistsResponse {
  artists: Artist[];
  total: number;
}

export default function AdminArtists() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [suspendTarget, setSuspendTarget] = useState<string | null>(null);

  const { data, isLoading } = useQuery<ArtistsResponse>({
    queryKey: ["admin", "artists"],
    queryFn: () => api.get<ArtistsResponse>("/admin/artists"),
  });

  const suspend = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.patch(`/admin/artists/${id}/suspend`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin"] });
      setSuspendTarget(null);
      setSuspendReason("");
      toast.success("Artista suspenso com sucesso");
    },
    onError: () => toast.error("Erro ao suspender artista"),
  });

  const activate = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/artists/${id}/activate`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin"] });
      toast.success("Artista reativado com sucesso");
    },
    onError: () => toast.error("Erro ao reativar artista"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/artists/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin"] });
      setConfirmDelete(null);
      toast.success("Artista removido permanentemente");
    },
    onError: () => toast.error("Erro ao remover artista"),
  });

  const filtered = (data?.artists ?? []).filter(
    (a) =>
      !search ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.email.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl font-semibold text-foreground mb-1">
          Gerenciar Artistas
        </h1>
        <p className="text-sm text-muted-foreground">
          {data?.total ?? 0} artistas cadastrados na plataforma
        </p>
        <div className="mt-2 h-px w-12 bg-[#C9A961]" />
      </div>

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

      {/* Artists List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#C9A961] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((artist) => (
            <Card key={artist.id} className="bg-card border-border">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-foreground truncate">{artist.name}</p>
                      <Badge
                        variant="outline"
                        className={
                          artist.isActive
                            ? "border-green-700 text-green-400 bg-green-950/30 text-[10px] shrink-0"
                            : "border-red-700 text-red-400 bg-red-950/30 text-[10px] shrink-0"
                        }
                      >
                        {artist.isActive ? "Ativo" : "Suspenso"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{artist.email}</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3 text-[#C9A961]" />
                        {Number(artist.rating).toFixed(1)} ({artist.totalReviews} avaliações)
                      </span>
                      <span>Preço base: {formatCurrency(artist.basePrice)}</span>
                      {artist.categories.slice(0, 2).map((c) => (
                        <span
                          key={c}
                          className="px-1.5 py-0.5 bg-muted text-muted-foreground"
                          style={{ borderRadius: "2px" }}
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                    {!artist.isActive && artist.suspendedReason && (
                      <p className="text-xs text-red-400 mt-1.5">
                        Motivo: {artist.suspendedReason}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {artist.isActive ? (
                      suspendTarget === artist.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="Motivo da suspensão..."
                            value={suspendReason}
                            onChange={(e) => setSuspendReason(e.target.value)}
                            className="bg-card border-border w-48 h-8 text-xs"
                            style={{ borderRadius: "2px" }}
                          />
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-8 text-xs"
                            style={{ borderRadius: "2px" }}
                            onClick={() =>
                              suspend.mutate({ id: artist.id, reason: suspendReason })
                            }
                            disabled={suspend.isPending}
                          >
                            Confirmar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs"
                            style={{ borderRadius: "2px" }}
                            onClick={() => setSuspendTarget(null)}
                          >
                            Cancelar
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs border-border text-muted-foreground hover:text-foreground"
                          style={{ borderRadius: "2px" }}
                          onClick={() => setSuspendTarget(artist.id)}
                        >
                          <ShieldOff className="h-3.5 w-3.5 mr-1.5" />
                          Suspender
                        </Button>
                      )
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs border-green-700/40 text-green-400 hover:bg-green-950/30"
                        style={{ borderRadius: "2px" }}
                        onClick={() => activate.mutate(artist.id)}
                        disabled={activate.isPending}
                      >
                        <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
                        Reativar
                      </Button>
                    )}

                    {confirmDelete === artist.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-red-400">Confirmar exclusão?</span>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-8 text-xs"
                          style={{ borderRadius: "2px" }}
                          onClick={() => remove.mutate(artist.id)}
                          disabled={remove.isPending}
                        >
                          Excluir
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs"
                          style={{ borderRadius: "2px" }}
                          onClick={() => setConfirmDelete(null)}
                        >
                          Não
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-red-400"
                        style={{ borderRadius: "2px" }}
                        onClick={() => setConfirmDelete(artist.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhum artista encontrado</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
