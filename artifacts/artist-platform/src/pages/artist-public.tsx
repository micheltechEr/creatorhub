import { useState } from "react";
import { useParams } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useGetArtist,
  getGetArtistQueryKey,
  useGetArtistMedia,
  getGetArtistMediaQueryKey,
  useGetArtistReviews,
  getGetArtistReviewsQueryKey,
  useCreateOrder,
} from "@workspace/api-client-react";
import { Star, Clock, DollarSign, CheckCircle, Video, AlertCircle, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";

const orderSchema = z.object({
  clientName: z.string().min(2, "Nome é obrigatório"),
  clientEmail: z.string().email("E-mail inválido"),
  title: z.string().min(3, "Descreva brevemente o pedido"),
  occasion: z.string().optional(),
  description: z.string().optional(),
  additionalInstructions: z.string().optional(),
  deadline: z.string().min(1, "Data de entrega é obrigatória"),
});

type OrderFormValues = z.infer<typeof orderSchema>;

function StarRating({ rating, size = "sm" }: { rating: number; size?: "sm" | "lg" }) {
  const cls = size === "lg" ? "h-5 w-5" : "h-3.5 w-3.5";
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`${cls} ${i < Math.round(rating) ? "fill-[#C9A961] text-[#C9A961]" : "text-[#4A4A4A] fill-[#4A4A4A]"}`}
        />
      ))}
    </div>
  );
}

function InteractiveStarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i + 1)}
          onMouseEnter={() => setHovered(i + 1)}
          onMouseLeave={() => setHovered(0)}
          className="cursor-pointer"
        >
          <Star
            className={`h-6 w-6 transition-colors ${
              i < (hovered || value) ? "fill-[#C9A961] text-[#C9A961]" : "text-[#D0D0D0] fill-[#D0D0D0]"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export default function ArtistPublic() {
  const params = useParams<{ artistId: string }>();
  const artistId = params.artistId ?? "";
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"portfolio" | "reviews" | "order">("portfolio");

  const { data: artist, isLoading: artistLoading, error: artistError } = useGetArtist(artistId, {
    query: { queryKey: getGetArtistQueryKey(artistId), enabled: !!artistId },
  });

  const { data: mediaData } = useGetArtistMedia(artistId, {
    query: { queryKey: getGetArtistMediaQueryKey(artistId), enabled: !!artistId },
  });

  const { data: reviewsData } = useGetArtistReviews(artistId, {}, {
    query: { queryKey: getGetArtistReviewsQueryKey(artistId), enabled: !!artistId },
  });

  const createOrderMutation = useCreateOrder();

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      clientName: "",
      clientEmail: "",
      title: "",
      occasion: "",
      description: "",
      additionalInstructions: "",
      deadline: "",
    },
  });

  const onSubmit = async (values: OrderFormValues) => {
    if (!artist) return;
    try {
      const order = await createOrderMutation.mutateAsync({
        data: {
          artistId,
          clientName: values.clientName,
          clientEmail: values.clientEmail,
          title: values.title,
          occasion: values.occasion || undefined,
          description: values.description || undefined,
          additionalInstructions: values.additionalInstructions || undefined,
          deadline: values.deadline,
          basePrice: artist.basePrice,
        },
      });
      setOrderId(order.id);
      setOrderPlaced(true);
      form.reset();
    } catch {
      toast.error("Erro ao enviar pedido. Tente novamente.");
    }
  };

  if (artistLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (artistError || !artist) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-10 w-10 text-secondary mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">Artista não encontrado</p>
          <p className="text-xs text-muted-foreground mt-1">Verifique o link e tente novamente</p>
        </div>
      </div>
    );
  }

  const media = mediaData?.media ?? [];
  const reviews = reviewsData?.reviews ?? [];
  const avgRating = reviewsData?.averageRating ?? 0;
  const totalReviews = reviewsData?.total ?? 0;

  const tabCls = (tab: typeof activeTab) =>
    `px-5 py-3 text-sm font-semibold uppercase tracking-[0.5px] transition-all border-b-2 cursor-pointer ${
      activeTab === tab
        ? "border-[#C9A961] text-[#0A0A0A]"
        : "border-transparent text-[#777] hover:text-[#0A0A0A]"
    }`;

  return (
    <div className="min-h-screen bg-background" style={{ fontFamily: "var(--font-sans)" }}>
      <Toaster />

      {/* HERO / HEADER */}
      <div className="bg-foreground text-background">
        <div className="max-w-5xl mx-auto px-6 py-14">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
            <div>
              {/* Platform brand */}
              <p className="text-xs text-secondary font-semibold uppercase tracking-[1px] mb-4">
                CREATOR HUB
              </p>
              <h1 className="font-serif text-5xl font-semibold text-background leading-tight mb-3">
                {artist.name}
              </h1>

              {/* Rating */}
              {totalReviews > 0 && (
                <div className="flex items-center gap-2 mb-4">
                  <StarRating rating={avgRating} />
                  <span className="text-sm text-secondary font-semibold">{Number(avgRating).toFixed(1)}</span>
                  <span className="text-sm text-muted-foreground">({totalReviews} avaliações)</span>
                </div>
              )}

              {/* Categories */}
              {artist.categories.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {artist.categories.map((cat) => (
                    <span
                      key={cat}
                      className="px-3 py-1 text-xs font-medium border border-secondary/40 text-secondary uppercase tracking-[0.5px]"
                      style={{ borderRadius: "2px" }}
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              )}

              {/* Bio */}
              {artist.bio && (
                <p className="text-muted-foreground text-sm leading-relaxed max-w-xl">{artist.bio}</p>
              )}
            </div>

            {/* Pricing card */}
            <div
              className="bg-background/5 border border-background/10 p-6 min-w-[220px]"
              style={{ borderRadius: "4px" }}
            >
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-secondary" />
                <span className="text-xs text-muted-foreground uppercase tracking-[0.5px]">A partir de</span>
              </div>
              <p className="font-serif text-4xl font-semibold text-background mb-3">
                {formatCurrency(artist.basePrice)}
              </p>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>Entrega em {artist.deliveryDays} dia{artist.deliveryDays !== 1 ? "s" : ""}</span>
              </div>

              {/* Availability badge */}
              <div className="mt-4 pt-4 border-t border-background/10">
                {artist.availability ? (
                  <div className="flex items-center gap-1.5 text-[#2D8A45] text-xs font-semibold">
                    <div className="h-2 w-2 rounded-full bg-[#2D8A45]" />
                    Aceitando pedidos
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-semibold">
                    <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                    Indisponível no momento
                  </div>
                )}
              </div>

              {artist.availability && (
                <button
                  onClick={() => setActiveTab("order")}
                  className="mt-4 w-full bg-secondary text-secondary-foreground text-sm font-semibold py-3 flex items-center justify-center gap-1.5 hover:opacity-90 transition-colors"
                  style={{ borderRadius: "2px" }}
                >
                  Fazer Pedido <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Tags */}
          {artist.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-6 pt-6 border-t border-background/10">
              {artist.tags.map((tag) => (
                <span key={tag} className="text-xs text-muted-foreground px-2 py-0.5 bg-background/5 border border-background/10" style={{ borderRadius: "2px" }}>
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* TABS */}
      <div className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 flex gap-0">
          <button className={tabCls("portfolio")} onClick={() => setActiveTab("portfolio")}>
            Portfólio {media.length > 0 && `(${media.length})`}
          </button>
          <button className={tabCls("reviews")} onClick={() => setActiveTab("reviews")}>
            Avaliações {totalReviews > 0 && `(${totalReviews})`}
          </button>
          {artist.availability && (
            <button className={tabCls("order")} onClick={() => setActiveTab("order")}>
              Fazer Pedido
            </button>
          )}
        </div>
      </div>

      {/* TAB CONTENT */}
      <div className="max-w-5xl mx-auto px-6 py-10">

        {/* PORTFOLIO TAB */}
        {activeTab === "portfolio" && (
          <div>
            <h2 className="font-serif text-2xl font-semibold text-foreground mb-6">Portfólio</h2>
            {media.length === 0 ? (
              <div className="bg-card border border-border p-16 text-center" style={{ borderRadius: "4px" }}>
                <Video className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Nenhum vídeo publicado ainda</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {media.map((item) => (
                  <div
                    key={item.id}
                    className="bg-card border border-border overflow-hidden"
                    style={{ borderRadius: "4px" }}
                  >
                    <div className="relative bg-[#0A0A0A] h-44 flex items-center justify-center">
                      <video
                        src={item.fileUrl}
                        className="h-full w-full object-cover"
                        controls
                        preload="metadata"
                      />
                    </div>
                    <div className="p-3">
                      <p className="text-xs font-medium text-foreground truncate">{item.fileName}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* REVIEWS TAB */}
        {activeTab === "reviews" && (
          <div>
            <h2 className="font-serif text-2xl font-semibold text-foreground mb-6">Avaliações</h2>

            {totalReviews === 0 ? (
              <div className="bg-card border border-border p-16 text-center" style={{ borderRadius: "4px" }}>
                <Star className="h-10 w-10 text-muted-foreground fill-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Nenhuma avaliação ainda</p>
              </div>
            ) : (
              <>
                {/* Summary */}
                <div className="bg-card border border-border p-6 mb-6 flex items-center gap-8" style={{ borderRadius: "4px" }}>
                  <div className="text-center">
                    <p className="font-serif text-5xl font-semibold text-foreground">{Number(avgRating).toFixed(1)}</p>
                    <StarRating rating={avgRating} size="lg" />
                    <p className="text-xs text-muted-foreground mt-1">{totalReviews} avaliações</p>
                  </div>
                  <div className="flex-1 space-y-2">
                    {[5, 4, 3, 2, 1].map((stars) => {
                      const count = reviews.filter((r) => r.rating === stars).length;
                      const pct = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
                      return (
                        <div key={stars} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-3">{stars}</span>
                          <Star className="h-3 w-3 fill-[#C9A961] text-[#C9A961] shrink-0" />
                          <div className="flex-1 h-1.5 bg-muted" style={{ borderRadius: "1px" }}>
                            <div className="h-full bg-[#C9A961] transition-all" style={{ width: `${pct}%`, borderRadius: "1px" }} />
                          </div>
                          <span className="text-xs text-muted-foreground w-4">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                    {reviews.map((review) => (
                    <div
                      key={review.id}
                      className="bg-card border border-border p-5"
                      style={{ borderRadius: "4px", borderLeft: "3px solid #C9A961" }}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <StarRating rating={review.rating} />
                        <span className="text-xs text-muted-foreground uppercase tracking-[0.3px]">
                          {new Date(review.createdAt as unknown as string).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                      {review.comment ? (
                        <p className="text-sm text-foreground leading-relaxed">{review.comment}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">Sem comentário</p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ORDER FORM TAB */}
        {activeTab === "order" && artist.availability && (
          <div>
            <h2 className="font-serif text-2xl font-semibold text-foreground mb-2">Solicitar Vídeo</h2>
            <p className="text-sm text-muted-foreground mb-8">
              Preencha as informações abaixo e aguarde a confirmação de <strong className="text-foreground">{artist.name}</strong>. O pagamento é realizado após a aprovação.
            </p>

            {orderPlaced ? (
              <div className="bg-card border border-border p-10 text-center" style={{ borderRadius: "4px" }}>
                <CheckCircle className="h-12 w-12 text-secondary mx-auto mb-4" />
                <h3 className="font-serif text-2xl font-semibold text-foreground mb-2">Pedido Enviado!</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Seu pedido foi enviado com sucesso. <strong>{artist.name}</strong> entrará em contato pelo e-mail informado.
                </p>
                {orderId && (
                  <div className="mt-4 inline-block px-4 py-2 bg-muted border border-border text-xs text-muted-foreground font-mono" style={{ borderRadius: "2px" }}>
                    Código: {orderId.slice(0, 8).toUpperCase()}
                  </div>
                )}
                <button
                  onClick={() => { setOrderPlaced(false); setOrderId(null); }}
                  className="mt-6 block mx-auto text-sm text-secondary font-semibold hover:underline"
                >
                  Fazer outro pedido
                </button>
              </div>
            ) : (
              <div className="bg-card border border-border" style={{ borderRadius: "4px" }}>
                <div className="px-6 py-4 border-b border-border">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.5px]">Seus dados de contato</p>
                </div>
                <div className="p-6">
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="clientName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-semibold uppercase tracking-[0.5px] text-foreground">
                                Nome completo *
                              </FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="João da Silva"
                                  className="h-11 border-border bg-background text-sm focus-visible:ring-0 focus-visible:border-foreground"
                                  style={{ borderRadius: "2px" }}
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="clientEmail"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-semibold uppercase tracking-[0.5px] text-foreground">
                                E-mail *
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="email"
                                  placeholder="joao@exemplo.com"
                                  className="h-11 border-border bg-background text-sm focus-visible:ring-0 focus-visible:border-foreground"
                                  style={{ borderRadius: "2px" }}
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="pt-2 border-t border-border">
                        <p className="text-xs font-semibold uppercase tracking-[0.5px] text-muted-foreground mb-4">Detalhes do vídeo</p>
                      </div>

                      <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                              <FormLabel className="text-xs font-semibold uppercase tracking-[0.5px] text-foreground">
                                Título do pedido *
                              </FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Ex: Mensagem de aniversário para minha mãe"
                                  className="h-11 border-border bg-background text-sm focus-visible:ring-0 focus-visible:border-foreground"
                                style={{ borderRadius: "2px" }}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="occasion"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-semibold uppercase tracking-[0.5px] text-foreground">
                                Ocasião
                              </FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Ex: Aniversário, Casamento..."
                                  className="h-11 border-border bg-background text-sm focus-visible:ring-0 focus-visible:border-foreground"
                                  style={{ borderRadius: "2px" }}
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="deadline"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-semibold uppercase tracking-[0.5px] text-foreground">
                                Prazo desejado *
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="date"
                                  min={new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0]}
                                  className="h-11 border-border bg-background text-sm focus-visible:ring-0 focus-visible:border-foreground"
                                  style={{ borderRadius: "2px" }}
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-semibold uppercase tracking-[0.5px] text-foreground">
                              O que você quer no vídeo?
                            </FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Descreva o que você deseja que seja dito ou feito no vídeo..."
                                rows={4}
                                className="border-border bg-background text-sm focus-visible:ring-0 focus-visible:border-foreground resize-none"
                                style={{ borderRadius: "2px" }}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="additionalInstructions"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-semibold uppercase tracking-[0.5px] text-foreground">
                              Instruções adicionais
                            </FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Pronúncia especial, tom desejado, idioma, etc..."
                                rows={3}
                                className="border-border bg-background text-sm focus-visible:ring-0 focus-visible:border-foreground resize-none"
                                style={{ borderRadius: "2px" }}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Price summary */}
                      <div className="bg-muted border border-border p-4 flex items-center justify-between" style={{ borderRadius: "2px" }}>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-[0.5px]">Valor base</p>
                          <p className="text-lg font-semibold text-foreground">{formatCurrency(artist.basePrice)}</p>
                        </div>
                        <p className="text-xs text-muted-foreground max-w-[200px] text-right">
                          Pagamento só será cobrado após aprovação do artista
                        </p>
                      </div>

                      <Button
                        type="submit"
                        className="w-full h-12 bg-foreground text-background font-semibold text-sm hover:opacity-90 transition-colors"
                        style={{ borderRadius: "2px" }}
                        disabled={createOrderMutation.isPending}
                      >
                        {createOrderMutation.isPending ? "Enviando pedido..." : "Enviar Pedido"}
                      </Button>
                    </form>
                  </Form>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* FOOTER */}
      <footer className="bg-foreground text-muted-foreground text-xs py-8 mt-10">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="text-secondary font-semibold">ArtistFlow</span>
          <span>© {new Date().getFullYear()} Todos os direitos reservados</span>
        </div>
      </footer>
    </div>
  );
}
