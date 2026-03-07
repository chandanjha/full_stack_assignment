"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import Navbar from "@/components/Navbar";
import { getSession, subscribeSessionChange, validateSession } from "@/services/auth-service";

export default function MainLayout({ children }) {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const redirectToLogin = useCallback(() => {
    if (typeof window !== "undefined") {
      window.location.replace("/login");
      return;
    }
    router.replace("/login");
  }, [router]);

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
        redirectToLogin();
        return;
      }

      const isValidSession = await validateSession();
      if (!isMounted) {
        return;
      }

      setIsAuthenticated(isValidSession);
      setIsReady(true);
      if (!isValidSession) {
        redirectToLogin();
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
  }, [redirectToLogin]);

  if (!isReady) {
    return (
      <main className="container py-5">
        <p className="text-muted">Loading...</p>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="container py-5">
        <p className="text-muted">Redirecting to login...</p>
      </main>
    );
  }

  return (
    <>
      <Navbar />
      <main className="container mt-4">
        {children}
      </main>
    </>
  );
}
