"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";

interface AuthGuardProps {
  children: React.ReactNode;
  requiredRole?: 'gom' | 'buyer' | 'admin';
}

export function AuthGuard({ children, requiredRole }: AuthGuardProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          router.push("/auth/login");
          return;
        }

        // Check role if specified
        if (requiredRole) {
          const userType = user.user_metadata?.user_type;
          if (userType !== requiredRole) {
            router.push("/unauthorized");
            return;
          }
        }

        setUser(user);
      } catch (error) {
        console.error("Auth error:", error);
        router.push("/auth/login");
      } finally {
        setLoading(false);
      }
    };

    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          router.push("/auth/login");
        } else if (event === 'SIGNED_IN') {
          // Refresh user data
          getUser();
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [router, supabase, requiredRole]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to login
  }

  return <>{children}</>;
}