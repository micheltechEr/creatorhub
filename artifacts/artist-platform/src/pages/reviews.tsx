import {
  useGetArtistReviews,
  getGetArtistReviewsQueryKey,
  useGetMe,
  getGetMeQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { Star } from "lucide-react";

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i < rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
}

export default function Reviews() {
  const { data: artist } = useGetMe({
    query: { queryKey: getGetMeQueryKey() },
  });

  const { data, isLoading } = useGetArtistReviews(
    artist?.id ?? "",
    {},
    {
      query: {
        queryKey: getGetArtistReviewsQueryKey(artist?.id ?? ""),
        enabled: !!artist?.id,
      },
    }
  );

  const reviews = data?.reviews ?? [];
  const avgRating = data?.averageRating ?? 0;
  const total = data?.total ?? 0;

  const ratingDistribution = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: reviews.filter((r) => r.rating === stars).length,
    percentage: total > 0 ? (reviews.filter((r) => r.rating === stars).length / total) * 100 : 0,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Avaliacoes</h1>
        <p className="text-muted-foreground mt-1">{total} avaliaco{total !== 1 ? "es" : "ao"} recebidas</p>
      </div>

      {/* Rating summary */}
      {total > 0 && (
        <Card className="rounded-2xl border-border/70 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start gap-8">
              <div className="text-center">
                <p className="text-6xl font-bold tracking-tight">{Number(avgRating).toFixed(1)}</p>
                <StarRating rating={Math.round(avgRating)} />
                <p className="text-sm text-muted-foreground mt-1">{total} avaliacoes</p>
              </div>
              <div className="flex-1 space-y-2">
                {ratingDistribution.map(({ stars, count, percentage }) => (
                  <div key={stars} className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground w-4">{stars}</span>
                    <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-yellow-400 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground w-4">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reviews list */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <Card className="rounded-2xl border-border/70 shadow-sm">
          <CardContent className="py-16 text-center">
            <Star className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-lg">Nenhuma avaliacao ainda</p>
            <p className="text-muted-foreground text-sm mt-1">
              Complete pedidos para receber avaliacoes dos clientes
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <Card key={review.id} className="rounded-2xl border-border/70 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <StarRating rating={review.rating} />
                      <span className="text-sm text-muted-foreground">
                        {formatDate(review.createdAt as unknown as string)}
                      </span>
                    </div>
                    {review.comment ? (
                      <p className="text-sm leading-relaxed">{review.comment}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">Sem comentario</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
