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

  const email = user.email?.toLowerCase() || "";
  // ONLY benedickluiser@gmail.com is allowed as admin
  if (email !== "benedickluiser@gmail.com") {
    return false;
  }

  // 🔍 Check role in database
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("Role error:", error.message);
    return true;
  }

  return data?.role === "admin" || email === "benedickluiser@gmail.com";
};