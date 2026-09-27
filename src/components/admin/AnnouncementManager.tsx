import { useState, useEffect } from "react";
import { Bell, Plus, AlertTriangle, CheckCircle2, ShieldAlert, Trash2, Calendar, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { fetchAnnouncements, saveAnnouncement, type AnnouncementItem } from "@/lib/bookingService";

export const AnnouncementManager = () => {
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New announcement form state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState<"Low" | "Normal" | "Urgent" | "Critical">("Normal");
  const [category, setCategory] = useState<"Weather" | "Advisory" | "Maintenance" | "Event">("Advisory");
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const data = await fetchAnnouncements();
    setAnnouncements(data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      alert("Please fill in the title and content.");
      return;
    }

    setSubmitting(true);
    try {
      await saveAnnouncement({
        title,
        content,
        priority,
        category,
        is_active: true,
      });

      alert("Announcement published successfully!");
      setTitle("");
      setContent("");
      setPriority("Normal");
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      alert("Error saving announcement: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case "Critical":
        return "bg-red-100 text-red-800 border-red-200";
      case "Urgent":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "Low":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-emerald-700" />
            <h3 className="text-xl font-black text-slate-900">Park Announcements & Safety Advisories</h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Broadcast emergency weather alerts, trail maintenance closures, and official DENR advisories to trekkers.
          </p>
        </div>

        <Button
          onClick={() => setIsModalOpen(true)}
          className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="w-4 h-4" /> New Announcement
        </Button>
      </div>

      {/* Announcements List */}
      {loading ? (
        <p className="text-xs text-slate-400 py-6 text-center">Loading announcements...</p>
      ) : announcements.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-xs">
          No active park announcements. Create one above.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {announcements.map((item) => (
            <div key={item.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${getPriorityBadge(item.priority)}`}>
                    {item.priority} Priority
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                    {item.category}
                  </span>
                </div>
                <span className="text-xs text-slate-400">
                  {new Date(item.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>

              <h4 className="text-sm font-bold text-slate-900">{item.title}</h4>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">{item.content}</p>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg bg-white rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900">
              Publish Park Announcement
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              This advisory will be displayed on the top portal banner and public announcements board.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4 mt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Announcement Title *
              </label>
              <input
                type="text"
                placeholder="e.g. Weather Advisory: Ridge Rain Alert on Mt. Mandalagan"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full border border-slate-300 rounded-xl p-3 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Priority Level
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="Low">Low</option>
                  <option value="Normal">Normal</option>
                  <option value="Urgent">Urgent</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="Advisory">Advisory</option>
                  <option value="Weather">Weather</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="Event">Event</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Content / Advisory Details *
              </label>
              <textarea
                rows={4}
                placeholder="Provide instructions, affected trails, recommended gear, or safety procedures..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full border border-slate-300 rounded-xl p-3 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                required
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs"
              >
                {submitting ? "Publishing..." : "Publish Advisory"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
