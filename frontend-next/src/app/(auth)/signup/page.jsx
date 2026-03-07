"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { signupAndLogin } from "@/services/auth-service";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Password and confirm password do not match");
      return;
    }

    setIsSubmitting(true);

    try {
      await signupAndLogin({ email, password });
      if (typeof window !== "undefined") {
        window.location.replace("/dashboard");
        return;
      }
      router.replace("/dashboard");
    } catch (requestError) {
      setError(requestError.message || "Unable to signup");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="row justify-content-center mt-5">
      <div className="col-12 col-md-8 col-lg-5">
        <div className="card shadow-sm">
          <div className="card-body p-4">
            <h2 className="mb-3">Signup</h2>

            {error ? <div className="alert alert-danger py-2">{error}</div> : null}

            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label htmlFor="signup-email" className="form-label">
                  Email
                </label>
                <input
                  id="signup-email"
                  type="email"
                  className="form-control"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>

              <div className="mb-3">
                <label htmlFor="signup-password" className="form-label">
                  Password
                </label>
                <input
                  id="signup-password"
                  type="password"
                  className="form-control"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <small className="text-muted">
                  8-16 chars with upper, lower, number, and special character.
                </small>
              </div>

              <div className="mb-3">
                <label htmlFor="signup-confirm-password" className="form-label">
                  Confirm Password
                </label>
                <input
                  id="signup-confirm-password"
                  type="password"
                  className="form-control"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn-success w-100" disabled={isSubmitting}>
                {isSubmitting ? "Creating account..." : "Signup"}
              </button>
            </form>

            <p className="mt-3 mb-0 text-center">
              Already have an account?{" "}
              <Link href="/login" className="link-primary">
                Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
