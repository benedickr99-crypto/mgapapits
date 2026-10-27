import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

export type Profile = {
  id: string;
  full_name: string | null;
  email?: string | null;
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
      return raw ? JSON.parse(raw) : null;
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
      let { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (!data && !error) {
        // If trigger is still generating the profile row right after signup, retry once
        await new Promise((r) => setTimeout(r, 600));
        const retry = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle();
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        console.warn("Could not fetch latest profile from DB:", error.message);
        // Keep user logged in with cached profile rather than forcefully signing out
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

    // Role is purely database-driven — no hardcoded email/name overrides.
    if (!profileData) {
      // Create a minimal placeholder profile; the DB trigger should handle this,
      // but if it hasn't fired yet, default new users to trekker.
      profileData = {
        id: currentUser.id,
        full_name: (currentUser.user_metadata?.full_name as string) || currentUser.email?.split("@")[0] || "User",
        phone: null,
        role: "trekker",
        nationality: null,
      };
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

    let lastToken = "";

    const processSession = async (currentSession: Session | null) => {
      const currentUser = currentSession?.user ?? null;

      if (!isMounted || !currentUser) return;

      const token = currentSession?.access_token || currentUser.id;
      if (token === lastToken) return;
      lastToken = token;

      setSession(currentSession);
      setUser(currentUser);

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
    };

    // 1. Listen for Supabase auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        if (!isMounted) return;

        if (event === "SIGNED_OUT") {
          // Explicit sign out: clear user state and storage
          setUser(null);
          setSession(null);
          setProfile(null);
          clearAuthStorage();
          setLoading(false);
        } else if (currentSession) {
          // Valid session received: update user, session, profile & persist to localStorage
          processSession(currentSession);
        } else if (event === "INITIAL_SESSION") {
          // If Supabase reports null on initial handshake:
          // Check if we already have a cached user in localStorage.
          // DO NOT wipe the user if we have a valid cached session!
          const cachedUser = localStorage.getItem("nnnp_auth_user");
          if (!cachedUser) {
            setUser(null);
            setSession(null);
            setProfile(null);
          }
          setLoading(false);
        }
      }
    );

    // 2. Initial session check & recovery
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (!error && data?.session) {
          processSession(data.session);
        } else if (error) {
          console.warn("getSession notice:", error.message);
          // Do NOT clearAuthStorage() here! Network glitches or lock timeouts must NOT log user out.
        }
      })
      .catch((err) => {
        console.warn("getSession error:", err);
        // Do NOT clearAuthStorage() here!
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    // 3. Safety timeout: Never stay stuck on loading for more than 1.5 seconds
    const timeout = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 1500);

    return () => {
      isMounted = false;
      clearTimeout(timeout);
      listener.subscription.unsubscribe();
    };
  }, []);


  // Role is purely determined by the database profile.role value — no overrides.
  const isAdmin = profile?.role === "admin";
  const isGuide = !isAdmin && profile?.role === "guide";
  const role = profile?.role || "trekker";

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