import { useEffect, useState } from "react";
import { observeAuth, getUserProfile } from "./authService";
import { AuthContext } from "./authContext";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = observeAuth(async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }
      setUser(firebaseUser);
      try {
        const data = await getUserProfile(firebaseUser.uid);
        setProfile(data);
      } catch {
        setProfile(null);
      } finally {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  const value = {
    user,
    profile,
    role: profile?.role ?? null,
    loading,
    refreshProfile: async () => {
      if (!user) return;
      setProfile(await getUserProfile(user.uid));
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
