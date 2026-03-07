"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import Navbar from "@/components/Navbar";
import { getSession, subscribeSessionChange } from "@/services/auth-service";

export default function MainLayout({ children }) {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const syncAuthState = () => {
      const session = getSession();
      const hasToken = Boolean(session?.token?.access_token);
      setIsAuthenticated(hasToken);
      setIsReady(true);
      if (!hasToken) {
        router.replace("/login");
      }
    };

    syncAuthState();
    return subscribeSessionChange(syncAuthState);
  }, [router]);

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
