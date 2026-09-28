import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

export type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: string;
  nationality: string | null;
  bio?: string | null;
  experience_years?: number;
  certifications?: string | null;
  image_url?: string | null;
  is_available?: boolean;
  guide_id_url?: string | null;
  guide_application_status?: string | null;
};

type AuthContextType = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  isGuide: boolean;
  role: string | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  isAdmin: false,
  isGuide: false,
  role: null,
  refreshProfile: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // ⚡ INSTANT BOOT: Initialize from local cache if available so UI doesn't block
  const [session, setSession] = useState<Session | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem("nnnp_auth_session");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem("nnnp_auth_user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const [profile, setProfile] = useState<Profile | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem("nnnp_auth_profile");
      const p = raw ? JSON.parse(raw) : null;
      const userRaw = localStorage.getItem("nnnp_auth_user");
      const u = userRaw ? JSON.parse(userRaw) : null;
      const email = u?.email?.toLowerCase() || "";
      if (email === "benedickluiser@gmail.com") {
        if (p) return { ...p, role: "admin" };
      } else if (p && p.role === "admin") {
        return { ...p, role: "trekker" };
      }
      return p;
    } catch {
      return null;
    }
  });

  // If we already have a cached user, we can set loading to false immediately!
  const [loading, setLoading] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      return !localStorage.getItem("nnnp_auth_user");
    } catch {
      return true;
    }
  });

  const clearAuthStorage = () => {
    try {
      localStorage.removeItem("nnnp_auth_session");
      localStorage.removeItem("nnnp_auth_user");
      localStorage.removeItem("nnnp_auth_profile");
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith("sb-") && k.endsWith("-auth-token")) {
          localStorage.removeItem(k);
        }
      }
    } catch {}
  };

  const signOut = async () => {
    setUser(null);
    setSession(null);
    setProfile(null);
    clearAuthStorage();
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) {
        if (
          (error as any).status === 401 ||
          (error as any).code === "PGRST301" ||
          error.message?.toLowerCase().includes("jwt")
        ) {
          console.warn("Session token expired or unauthorized. Clearing credentials.");
          signOut().catch(() => {});
        } else {
          console.error("Error fetching profile:", error);
        }
        return null;
      }
      return data as Profile;
    } catch (err) {
      console.error("Profile fetch error:", err);
      return null;
    }
  };

  const handleProfileSync = async (currentUser: User, rawProfile: Profile | null) => {
    let profileData = rawProfile;
    const email = currentUser.email?.toLowerCase() || "";
    
    // Auto-promote system admin accounts (ONLY benedickluiser@gmail.com)
    const isTargetAdmin = email === "benedickluiser@gmail.com";

    if (isTargetAdmin) {
      if (profileData?.role !== "admin") {
        try {
          await supabase.from("profiles").update({ role: "admin" as any }).eq("id", currentUser.id);
          await supabase.auth.updateUser({ data: { role: "admin" } }).catch(() => {});
          if (profileData) {
            profileData = { ...profileData, role: "admin" };
          } else {
            profileData = {
              id: currentUser.id,
              full_name: currentUser.user_metadata?.full_name || "Admin",
              phone: null,
              role: "admin",
              nationality: null,
            };
          }
          try {
            localStorage.setItem("nnnp_auth_profile", JSON.stringify(profileData));
          } catch {}
        } catch (e) {
          console.error("Failed to promote admin:", e);
        }
      }
    } else if (profileData?.role === "admin") {
      // Revert any unauthorized admin accounts to trekker
      try {
        await supabase.from("profiles").update({ role: "trekker" as any }).eq("id", currentUser.id);
        await supabase.auth.updateUser({ data: { role: "trekker" } }).catch(() => {});
        profileData = { ...profileData, role: "trekker" };
        try {
          localStorage.setItem("nnnp_auth_profile", JSON.stringify(profileData));
        } catch {}
      } catch (e) {
        console.error("Failed to demote unauthorized admin:", e);
      }
    }
    return profileData;
  };

  const refreshProfile = useCallback(async () => {
    if (user) {
      let profileData = await fetchProfile(user.id);
      profileData = await handleProfileSync(user, profileData);
      setProfile(profileData);
      if (profileData) {
        try {
          localStorage.setItem("nnnp_auth_profile", JSON.stringify(profileData));
        } catch {}
      }
    }
  }, [user]);

  useEffect(() => {
    let isMounted = true;
    let authInitialized = false;

    const processSession = async (currentSession: Session | null) => {
      const currentUser = currentSession?.user ?? null;

      if (!isMounted) return;
      setSession(currentSession);
      setUser(currentUser);

      if (currentUser) {
        try {
          localStorage.setItem("nnnp_auth_session", JSON.stringify(currentSession));
          localStorage.setItem("nnnp_auth_user", JSON.stringify(currentUser));
        } catch {}

        // Fetch / sync profile in background
        const profileData = await fetchProfile(currentUser.id);
        const synced = await handleProfileSync(currentUser, profileData);

        if (isMounted) {
          if (synced) {
            setProfile(synced);
            try {
              localStorage.setItem("nnnp_auth_profile", JSON.stringify(synced));
            } catch {}
          }
          setLoading(false);
        }
      } else {
        try {
          localStorage.removeItem("nnnp_auth_session");
          localStorage.removeItem("nnnp_auth_user");
          localStorage.removeItem("nnnp_auth_profile");
        } catch {}

        if (isMounted) {
          setProfile(null);
          setLoading(false);
        }
      }
    };

    // Listen for auth changes
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        authInitialized = true;
        processSession(currentSession);
      }
    );

    // Initial session check
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) {
          if (
            error.message?.toLowerCase().includes("refresh token") ||
            (error as any).status === 400
          ) {
            // Stale or invalid refresh token in storage: clean up so browser stops retrying with 400
            supabase.auth.signOut().catch(() => {});
            try {
              for (let i = localStorage.length - 1; i >= 0; i--) {
                const k = localStorage.key(i);
                if (k && k.startsWith("sb-") && k.endsWith("-auth-token")) {
                  localStorage.removeItem(k);
                }
              }
            } catch {}
          }
        }
        if (!authInitialized) {
          processSession(data?.session ?? null);
        }
      })
      .catch((err) => {
        if (err?.message?.toLowerCase().includes("refresh token")) {
          supabase.auth.signOut().catch(() => {});
        }
        if (!authInitialized) {
          processSession(null);
        }
      });

    // Safety timeout: Never stay stuck on loading for more than 1.5 seconds
    const timeout = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 1500);

    return () => {
      isMounted = false;
      clearTimeout(timeout);
      listener.subscription.unsubscribe();
    };
  }, []);


  const userEmail = user?.email?.toLowerCase() || "";
  const isAdmin = userEmail === "benedickluiser@gmail.com";
  const isGuide = !isAdmin && profile?.role === "guide";
  const role = isAdmin ? "admin" : (profile?.role === "admin" ? "trekker" : (profile?.role ?? null));

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        isAdmin,
        isGuide,
        role,
        refreshProfile,
        signOut,
      }}
    >
      {loading ? (
        <div className="flex items-center justify-center h-screen bg-gray-50">
          <p className="text-gray-500 font-medium">Loading app...</p>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);