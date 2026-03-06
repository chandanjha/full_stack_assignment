import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ACCESS_TOKEN_COOKIE } from "@/lib/auth";
import { BACKEND_API_BASE_URL } from "@/lib/config";

function parseBackendPayload(body) {
  const trimmedBody = body.trim();
  if (!trimmedBody) {
    return null;
  }

  try {
    return JSON.parse(trimmedBody);
  } catch {
    return trimmedBody;
  }
}

function toFieldErrors(errors) {
  if (!errors?.length) {
    return {};
  }

  const fieldErrors = {};
  for (const error of errors) {
    if (!error?.field || !error.message) {
      continue;
    }

    const fieldKey = error.field.split(".").pop()?.trim();
    if (fieldKey && !fieldErrors[fieldKey]) {
      fieldErrors[fieldKey] = error.message;
    }
  }

  return fieldErrors;
}

function getQueryValue(value) {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }

  return "";
}

function redirectWithError(error, email, fieldErrors = {}) {
  const query = new URLSearchParams();
  if (error) {
    query.set("error", error);
  }
  if (email) {
    query.set("email", email);
  }
  if (fieldErrors.email) {
    query.set("field_email", fieldErrors.email);
  }
  if (fieldErrors.password) {
    query.set("field_password", fieldErrors.password);
  }
  if (fieldErrors.confirmPassword) {
    query.set("field_confirm_password", fieldErrors.confirmPassword);
  }

  redirect(`/signup?${query.toString()}`);
}

async function signupAction(formData) {
  "use server";

  const email = typeof formData.get("email") === "string" ? formData.get("email").trim() : "";
  const password = typeof formData.get("password") === "string" ? formData.get("password") : "";
  const confirmPassword = typeof formData.get("confirmPassword") === "string"
    ? formData.get("confirmPassword")
    : "";

  const fieldErrors = {};
  if (!email) {
    fieldErrors.email = "Email is required";
  }
  if (!password) {
    fieldErrors.password = "Password is required";
  }
  if (!confirmPassword) {
    fieldErrors.confirmPassword = "Confirm password is required";
  }
  if (password && confirmPassword && password !== confirmPassword) {
    fieldErrors.confirmPassword = "Passwords do not match";
  }
  if (password && password.length < 8) {
    fieldErrors.password = "Password must be at least 8 characters";
  }

  if (Object.keys(fieldErrors).length > 0) {
    redirectWithError("Please correct the highlighted fields", email, fieldErrors);
  }

  try {
    const backendResponse = await fetch(`${BACKEND_API_BASE_URL}/v1/auth/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });
    const responseBody = await backendResponse.text();
    const parsedBody = parseBackendPayload(responseBody);

    if (!backendResponse.ok) {
      if (parsedBody && typeof parsedBody === "object") {
        const apiFieldErrors = toFieldErrors(parsedBody.errors);
        const errorMessage = parsedBody.errors?.[0]?.message || parsedBody.detail || parsedBody.message || "Signup failed";
        redirectWithError(errorMessage, email, apiFieldErrors);
      }

      const fallbackError = typeof parsedBody === "string" && parsedBody.trim() ? parsedBody : "Signup failed";
      redirectWithError(fallbackError, email);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Signup failed";
    redirectWithError(message, email);
  }

  redirect("/login");
}

export default async function SignupPage({ searchParams }) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;

  if (accessToken) {
    redirect("/dashboard");
  }

  const resolvedSearchParams = await searchParams;
  const error = getQueryValue(resolvedSearchParams?.error);
  const fieldErrors = {
    email: getQueryValue(resolvedSearchParams?.field_email),
    password: getQueryValue(resolvedSearchParams?.field_password),
    confirmPassword: getQueryValue(resolvedSearchParams?.field_confirm_password),
  };
  const initialEmail = getQueryValue(resolvedSearchParams?.email);

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-lg shadow-xl p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900">Create Account</h1>
              <p className="text-gray-600 mt-2">Join us today</p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            {/* Signup Form */}
            <form action={signupAction} className="space-y-4">
              {/* Email Input */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  defaultValue={initialEmail}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="you@example.com"
                  required
                />
                {fieldErrors.email && (
                  <p className="mt-2 text-sm text-red-600">{fieldErrors.email}</p>
                )}
              </div>

              {/* Password Input */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="••••••••"
                  required
                />
                {fieldErrors.password && (
                  <p className="mt-2 text-sm text-red-600">{fieldErrors.password}</p>
                )}
              </div>

              {/* Confirm Password Input */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="••••••••"
                  required
                />
                {fieldErrors.confirmPassword && (
                  <p className="mt-2 text-sm text-red-600">{fieldErrors.confirmPassword}</p>
                )}
              </div>

              {/* Terms & Conditions */}
              <label className="flex items-start gap-2">
                <input type="checkbox" className="mt-1" required />
                <span className="text-sm text-gray-700">
                  I agree to the{" "}
                  <Link href="/terms" className="text-blue-600 hover:text-blue-700">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" className="text-blue-600 hover:text-blue-700">
                    Privacy Policy
                  </Link>
                </span>
              </label>

              {/* Submit Button */}
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition duration-200 mt-6"
              >
                Sign Up
              </button>
            </form>

            {/* Divider */}
            <div className="my-6 flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-300"></div>
              <span className="text-gray-500 text-sm">or</span>
              <div className="flex-1 h-px bg-gray-300"></div>
            </div>

            {/* Sign In Link */}
            <div className="text-center">
              <p className="text-gray-700">
                Already have an account?{" "}
                <Link href="/login" className="text-blue-600 hover:text-blue-700 font-semibold">
                  Sign in
                </Link>
              </p>
            </div>
          </div>

          {/* Footer Info */}
          <p className="text-center text-gray-600 text-sm mt-6">
            Protected by industry-standard security
          </p>
        </div>
      </div>
    </>
  );
}
