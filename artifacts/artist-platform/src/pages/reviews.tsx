import {
  useGetArtistReviews,
  getGetArtistReviewsQueryKey,
  useGetMe,
  getGetMeQueryKey,
} from "@workspace/api-client-react";
import { formatDate } from "@/lib/format";
import { Star } from "lucide-react";

const cardStyle = {
  borderRadius: "4px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
};

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${
            i < rating
              ? "fill-[#C9A961] text-[#C9A961]"
              : "text-[#E5E5E5] fill-[#E5E5E5]"
          }`}
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
    percentage:
      total > 0 ? (reviews.filter((r) => r.rating === stars).length / total) * 100 : 0,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-serif text-4xl font-semibold text-foreground">Avaliações</h1>
        <p className="text-sm text-muted-foreground mt-1 uppercase tracking-[0.3px]">
          {total} avaliação{total !== 1 ? "s" : ""} recebida{total !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Summary */}
      {total > 0 && (
        <div className="bg-white border border-border p-6" style={cardStyle}>
          <div className="flex items-start gap-10">
            <div className="text-center min-w-[100px]">
              <p className="font-serif text-6xl font-semibold text-foreground leading-none mb-2">
                {Number(avgRating).toFixed(1)}
              </p>
              <StarRating rating={Math.round(avgRating)} />
              <p className="text-xs text-muted-foreground mt-2 uppercase tracking-[0.3px]">
                {total} avaliações
              </p>
            </div>
            <div className="flex-1 space-y-2.5">
              {ratingDistribution.map(({ stars, count, percentage }) => (
                <div key={stars} className="flex items-center gap-3">
                  <span className="text-xs font-medium text-muted-foreground w-3">{stars}</span>
                  <Star className="h-3.5 w-3.5 fill-[#C9A961] text-[#C9A961] shrink-0" />
                  <div className="flex-1 h-1.5 bg-[#F0F0F0] overflow-hidden" style={{ borderRadius: "1px" }}>
                    <div
                      className="h-full bg-[#C9A961] transition-all duration-500"
                      style={{ width: `${percentage}%`, borderRadius: "1px" }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-4">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-[#F8F8F8] border border-border animate-pulse" style={{ borderRadius: "4px" }} />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="bg-white border border-border p-16 text-center" style={cardStyle}>
          <Star className="h-10 w-10 text-[#E5E5E5] fill-[#E5E5E5] mx-auto mb-3" />
          <p className="text-sm text-muted-foreground font-medium">Nenhuma avaliação ainda</p>
          <p className="text-xs text-muted-foreground mt-1">
            Complete pedidos para receber avaliações dos clientes
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="bg-white border border-border p-5"
              style={{ ...cardStyle, borderLeft: "4px solid #C9A961" }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <StarRating rating={review.rating} />
                    <span className="text-xs text-muted-foreground uppercase tracking-[0.3px]">
                      {formatDate(review.createdAt as unknown as string)}
                    </span>
                  </div>
                  {review.comment ? (
                    <p className="text-sm leading-relaxed text-foreground">{review.comment}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Sem comentário</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
