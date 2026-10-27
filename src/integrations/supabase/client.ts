import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || "https://kmmgtcyegvbrgsdbdtsh.supabase.co";
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "sb_publishable_4C7O_-0J8ATRio4Ekxrb2A_L9SYLK7f";

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    // Prevents navigator.locks timeout and lock stealing AbortErrors during rapid mounts/network drops
    lock: async (_name, _acquireTimeout, fn) => {
      return await fn();
    },
  },
});
