import { supabase } from "@/integrations/supabase/client";

export const isAdmin = async () => {
  // 🔐 Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("No user logged in");
    return false;
  }

  // 🔍 Check role in database
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (error) {
    return false;
  }

  return data?.role === "admin";
};