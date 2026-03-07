"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getSession, login } from "@/services/auth-service";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const existingSession = getSession();
    if (existingSession?.token?.access_token) {
      router.replace("/dashboard");
    }
  }, [router]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await login({ email, password });
      if (typeof window !== "undefined") {
        window.location.replace("/dashboard");
        return;
      }
      router.replace("/dashboard");
    } catch (requestError) {
      setError(requestError.message || "Unable to login");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="row justify-content-center mt-5">
      <div className="col-12 col-md-8 col-lg-5">
        <div className="card shadow-sm">
          <div className="card-body p-4">
            <h2 className="mb-3">Login</h2>

            {error ? <div className="alert alert-danger py-2">{error}</div> : null}

            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label htmlFor="login-email" className="form-label">
                  Email
                </label>
                <input
                  id="login-email"
                  type="email"
                  className="form-control"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>

              <div className="mb-3">
                <label htmlFor="login-password" className="form-label">
                  Password
                </label>
                <input
                  id="login-password"
                  type="password"
                  className="form-control"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary w-100" disabled={isSubmitting}>
                {isSubmitting ? "Logging in..." : "Login"}
              </button>
            </form>

            <p className="mt-3 mb-0 text-center">
              No account?{" "}
              <Link href="/signup" className="link-primary">
                Signup
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
