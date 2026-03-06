import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  USER_SNAPSHOT_COOKIE,
  serializeUserSnapshot,
} from "@/lib/auth";
import { BACKEND_API_BASE_URL } from "@/lib/config";

const ACCESS_TOKEN_MAX_AGE_SECONDS = 60 * 60;
const REFRESH_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function buildCookieOptions(maxAge) {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

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

function extractLoginTokens(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  if (
    typeof payload.access_token === "string"
    && typeof payload.refresh_token === "string"
    && typeof payload.token_type === "string"
  ) {
    return payload;
  }

  const nestedToken = payload.data?.token;
  if (
    !nestedToken
    || typeof nestedToken !== "object"
    || typeof nestedToken.access_token !== "string"
    || typeof nestedToken.refresh_token !== "string"
    || typeof nestedToken.token_type !== "string"
  ) {
    return null;
  }

  return nestedToken;
}

function extractLoginUser(payload) {
  const user = payload?.data?.user;

  if (
    !user
    || typeof user !== "object"
    || typeof user.id !== "string"
    || typeof user.email !== "string"
    || typeof user.role !== "string"
    || typeof user.is_active !== "boolean"
  ) {
    return null;
  }

  return user;
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

  redirect(`/login?${query.toString()}`);
}

async function loginAction(formData) {
  "use server";

  const email = typeof formData.get("email") === "string" ? formData.get("email").trim() : "";
  const password = typeof formData.get("password") === "string" ? formData.get("password") : "";

  const fieldErrors = {};
  if (!email) {
    fieldErrors.email = "Email is required";
  }
  if (!password) {
    fieldErrors.password = "Password is required";
  }

  if (Object.keys(fieldErrors).length > 0) {
    redirectWithError("Please correct the highlighted fields", email, fieldErrors);
  }

  try {
    const backendResponse = await fetch(`${BACKEND_API_BASE_URL}/v1/auth/login`, {
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
        const errorMessage = parsedBody.errors?.[0]?.message || parsedBody.detail || parsedBody.message || "Login failed";
        redirectWithError(errorMessage, email, apiFieldErrors);
      }

      const fallbackError = typeof parsedBody === "string" && parsedBody.trim() ? parsedBody : "Login failed";
      redirectWithError(fallbackError, email);
    }

    const loginResponse = extractLoginTokens(parsedBody);
    const loginUser = extractLoginUser(parsedBody);
    if (!loginResponse) {
      redirectWithError("Login response is missing tokens", email);
    }

    const cookieStore = await cookies();
    cookieStore.set(
      ACCESS_TOKEN_COOKIE,
      loginResponse.access_token,
      buildCookieOptions(ACCESS_TOKEN_MAX_AGE_SECONDS),
    );
    cookieStore.set(
      REFRESH_TOKEN_COOKIE,
      loginResponse.refresh_token,
      buildCookieOptions(REFRESH_TOKEN_MAX_AGE_SECONDS),
    );

    const serializedUserSnapshot = serializeUserSnapshot(loginUser);
    if (serializedUserSnapshot) {
      cookieStore.set(
        USER_SNAPSHOT_COOKIE,
        serializedUserSnapshot,
        buildCookieOptions(REFRESH_TOKEN_MAX_AGE_SECONDS),
      );
    } else {
      cookieStore.delete(USER_SNAPSHOT_COOKIE);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed";
    redirectWithError(message, email);
  }

  redirect("/dashboard");
}

export default async function LoginPage({ searchParams }) {
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
  };
  const initialEmail = getQueryValue(resolvedSearchParams?.email);

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-lg shadow-xl p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900">Welcome Back</h1>
              <p className="text-gray-600 mt-2">Sign in to your account</p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            {/* Login Form */}
            <form action={loginAction} className="space-y-5">
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

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded" />
                  <span className="text-gray-700">Remember me</span>
                </label>
                <Link href="/forgot-password" className="text-blue-600 hover:text-blue-700 font-medium">
                  Forgot password?
                </Link>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition duration-200"
              >
                Sign In
              </button>
            </form>

            {/* Divider */}
            <div className="my-6 flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-300"></div>
              <span className="text-gray-500 text-sm">or</span>
              <div className="flex-1 h-px bg-gray-300"></div>
            </div>

            {/* Sign Up Link */}
            <div className="text-center">
              <p className="text-gray-700">
                Don't have an account?{" "}
                <Link href="/signup" className="text-blue-600 hover:text-blue-700 font-semibold">
                  Sign up
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
