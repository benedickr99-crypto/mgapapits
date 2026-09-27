import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export type Notification = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  link?: string;
  entity_id?: string;
  created_at: string;
};

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch initial notifications
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50); // Keep it lightweight

    if (error) {
      if ((error as any).status === 401 || (error as any).code === "PGRST301") {
        return;
      }
      console.error("Error fetching notifications:", error);
      return;
    }

    if (data) {
      setNotifications(data as Notification[]);
      setUnreadCount(data.filter((n) => !n.read).length);
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();

    if (!user) return;

    // Real-time subscription to notifications targeting this specific user
    const channel = supabase
      .channel(`notifications_${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          
          // Add to state
          setNotifications((prev) => [newNotification, ...prev]);
          setUnreadCount((prev) => prev + 1);

          // Show a beautiful toast popup
          toast(newNotification.title, {
            description: newNotification.message,
            icon: newNotification.type === 'booking_created' ? '🔔' : 
                  newNotification.type === 'booking_approved' ? '✅' : '❌',
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchNotifications]);

  // Mark a single notification as read
  const markAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", id);
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length === 0) return;

    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);

    // Update in database
    await supabase
      .from("notifications")
      .update({ read: true })
      .in('id', unreadIds);
  };

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
  };
}
