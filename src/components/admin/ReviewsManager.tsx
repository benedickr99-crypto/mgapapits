import { useState, useEffect } from "react";
import { Star, MessageSquare, ShieldCheck, CheckCircle2, EyeOff, Eye, Trash2, Filter } from "lucide-react";
import { fetchReviews, type RatingReviewItem } from "@/lib/bookingService";
import { Button } from "@/components/ui/button";

export const ReviewsManager = () => {
  const [reviews, setReviews] = useState<RatingReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRating, setFilterRating] = useState<number | null>(null);

  const loadData = async () => {
    setLoading(true);
    const data = await fetchReviews();
    setReviews(data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = filterRating
    ? reviews.filter((r) => r.overall_rating === filterRating)
    : reviews;

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
            <h3 className="text-xl font-black text-slate-900">Ratings & Reviews Moderation</h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor trekker satisfaction scores, trail feedback, and accredited guide performance reviews.
          </p>
        </div>

        {/* Star Filter */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0">
          <button
            onClick={() => setFilterRating(null)}
            className={`text-xs font-bold px-2.5 py-1 rounded-lg transition ${
              filterRating === null ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600"
            }`}
          >
            All
          </button>
          {[5, 4, 3, 2, 1].map((stars) => (
            <button
              key={stars}
              onClick={() => setFilterRating(stars)}
              className={`text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-0.5 transition ${
                filterRating === stars ? "bg-white text-amber-600 shadow-2xs" : "text-slate-600"
              }`}
            >
              {stars} <Star className="w-3 h-3 fill-current" />
            </button>
          ))}
        </div>
      </div>

      {/* Reviews List */}
      {loading ? (
        <p className="text-xs text-slate-400 py-8 text-center">Loading trekker reviews...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-xs">
          No reviews found matching the selected filter.
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((rev) => (
            <div
              key={rev.id}
              className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4 transition-all hover:shadow-2xs"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 text-sm">{rev.user_name || "Verified Trekker"}</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                    Verified Trek
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">
                  {new Date(rev.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>

              {/* Ratings Badges */}
              <div className="flex flex-wrap items-center gap-3 text-xs mb-3">
                <div className="flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200/60 px-2.5 py-1 rounded-lg font-bold">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                  Overall: {rev.overall_rating} / 5
                </div>

                <div className="text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-[11px]">
                  Trail: <strong>{rev.trail_rating}/5</strong> ({rev.trail_name || "Trail"})
                </div>

                {rev.guide_rating && (
                  <div className="text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-[11px]">
                    Guide ({rev.guide_name || "Guide"}): <strong>{rev.guide_rating}/5</strong>
                  </div>
                )}
              </div>

              {/* Feedback text */}
              <p className="text-xs text-slate-700 bg-white p-3 rounded-xl border border-slate-200/60 leading-relaxed italic">
                "{rev.feedback_text}"
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
