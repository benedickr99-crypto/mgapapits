import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type BookingWithTrail = {
  id: string;
  climb_date: string;
  group_size: number;
  status: string;
  trail_id: string;
  trails: { name: string } | null;
};

export default function MyBookingsHook() {
  const [data, setData] = useState<BookingWithTrail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: bookings } = await supabase
        .from("bookings")
        .select("*, trails(name)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      setData((bookings as unknown as BookingWithTrail[]) || []);
      setLoading(false);
    };

    load();
  }, []);

  return { data, loading };
}
