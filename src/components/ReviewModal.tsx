import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Star, MessageSquare } from "lucide-react";
import { submitReview } from "@/lib/bookingService";

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: {
    id: string;
    userId: string;
    userName?: string;
    guideId?: string | null;
    guideName?: string | null;
    trailId: string;
    trailName?: string;
  };
  onSuccess?: () => void;
}

export const ReviewModal = ({ isOpen, onClose, booking, onSuccess }: ReviewModalProps) => {
  const [trailRating, setTrailRating] = useState(5);
  const [guideRating, setGuideRating] = useState(5);
  const [overallRating, setOverallRating] = useState(5);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim()) {
      alert("Please provide a brief feedback comment.");
      return;
    }

    setSubmitting(true);
    try {
      await submitReview({
        bookingId: booking.id,
        userId: booking.userId,
        userName: booking.userName,
        guideId: booking.guideId,
        guideName: booking.guideName,
        trailId: booking.trailId,
        trailName: booking.trailName,
        trailRating,
        guideRating: booking.guideId ? guideRating : undefined,
        overallRating,
        feedbackText: feedback,
      });

      alert("Thank you! Your review has been submitted.");
      onSuccess?.();
      onClose();
    } catch (err: any) {
      alert("Error submitting review: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = (value: number, onChange: (val: number) => void) => (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className="p-1 transition-transform hover:scale-110 focus:outline-none"
        >
          <Star
            className={`w-6 h-6 ${
              star <= value
                ? "text-amber-400 fill-amber-400"
                : "text-gray-300 stroke-gray-300"
            }`}
          />
        </button>
      ))}
      <span className="text-xs font-bold text-gray-700 ml-2">{value} / 5</span>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-6 bg-white rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-900">
            Rate Your Trekking Adventure
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-500">
            Help other trekkers and the DENR park management improve trails and guide services.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Trail Rating */}
          <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
              Trail Experience & Scenery ({booking.trailName || "Trail"})
            </label>
            {renderStars(trailRating, setTrailRating)}
          </div>

          {/* Guide Rating (if guide was assigned) */}
          {booking.guideId && (
            <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                Tour Guide Service ({booking.guideName || "Assigned Guide"})
              </label>
              {renderStars(guideRating, setGuideRating)}
            </div>
          )}

          {/* Overall Experience */}
          <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
              Overall Park Satisfaction
            </label>
            {renderStars(overallRating, setOverallRating)}
          </div>

          {/* Feedback Text */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
              Your Trekking Review & Tips
            </label>
            <textarea
              rows={3}
              placeholder="How was the trail condition? Any recommendations for future trekkers?"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="w-full border border-gray-300 rounded-xl p-3 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
              required
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl"
            >
              {submitting ? "Submitting..." : "Submit Review"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
