"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getSession, subscribeSessionChange, validateSession } from "@/services/auth-service";

export default function AuthLayout({ children }) {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const syncAuthState = async () => {
      const session = getSession();
      const hasToken = Boolean(session?.token?.access_token);

      if (!hasToken) {
        if (!isMounted) {
          return;
        }
        setIsAuthenticated(false);
        setIsReady(true);
        return;
      }

      const isValidSession = await validateSession();
      if (!isMounted) {
        return;
      }

      setIsAuthenticated(isValidSession);
      setIsReady(true);
      if (isValidSession) {
        router.replace("/dashboard");
      }
    };

    void syncAuthState();
    const unsubscribe = subscribeSessionChange(() => {
      void syncAuthState();
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [router]);

  if (!isReady) {
    return (
      <main className="container py-5">
        <p className="text-muted">Loading...</p>
      </main>
    );
  }

  if (isAuthenticated) {
    return (
      <main className="container py-5">
        <p className="text-muted">Redirecting to dashboard...</p>
      </main>
    );
  }

  return (
    <main className="container py-4">
      {children}
    </main>
  );
}
