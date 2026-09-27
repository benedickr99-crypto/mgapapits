import { useState } from "react";
import { Bell, Check, CheckCircle2 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useNavigate } from "react-router-dom";
import { useNotifications, type Notification } from "@/hooks/useNotifications";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    setOpen(false); // Close the dropdown

    if (notification.link) {
      let url = notification.link;
      if (notification.entity_id) {
        url += `?bookingId=${notification.entity_id}`;
      }
      navigate(url);
    } else {
      // FALLBACK for old notifications created before the link column was added
      if (notification.type === 'booking_created') {
        navigate('/admin');
      } else {
        navigate('/my-bookings');
      }
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500/20">
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-sm ring-2 ring-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      
      <PopoverContent align="end" className="w-[calc(100vw-2rem)] sm:w-80 p-0 bg-white rounded-2xl shadow-xl border-gray-100 overflow-hidden z-50 mr-4 sm:mr-0">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50/50">
          <h3 className="font-semibold text-sm text-gray-900">Notifications</h3>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllAsRead()}
              className="text-[11px] font-medium text-green-600 hover:text-green-700 transition flex items-center gap-1"
            >
              <Check size={12} /> Mark all read
            </button>
          )}
        </div>

        <ScrollArea className="h-[350px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center px-4">
              <div className="bg-gray-50 p-3 rounded-full mb-3">
                <Bell size={20} className="text-gray-400" />
              </div>
              <p className="text-sm text-gray-500 font-medium">No notifications yet</p>
              <p className="text-xs text-gray-400 mt-1">When you get updates, they'll show up here.</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`px-4 py-3 border-b last:border-0 cursor-pointer transition-colors hover:bg-gray-100 flex gap-3 group ${
                    notification.read ? 'opacity-70' : 'bg-green-50/30'
                  }`}
                >
                  <div className="mt-0.5">
                    {notification.type === 'booking_created' ? (
                      <div className="h-2 w-2 mt-1.5 rounded-full bg-blue-500" />
                    ) : notification.type === 'booking_approved' ? (
                      <div className="h-2 w-2 mt-1.5 rounded-full bg-green-500" />
                    ) : (
                      <div className="h-2 w-2 mt-1.5 rounded-full bg-red-500" />
                    )}
                  </div>
                  
                  <div className="flex-1 space-y-1">
                    <p className={`text-sm ${notification.read ? 'text-gray-700 font-medium' : 'text-gray-900 font-semibold'}`}>
                      {notification.title}
                    </p>
                    <p className="text-xs text-gray-500 leading-snug">
                      {notification.message}
                    </p>
                    <p className="text-[10px] text-gray-400 font-medium pt-1">
                      {formatTimeAgo(notification.created_at)}
                    </p>
                  </div>

                  {!notification.read && (
                    <div className="self-center">
                      <CheckCircle2 size={16} className="text-green-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
