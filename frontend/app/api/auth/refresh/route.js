import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/lib/auth";
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

function extractTokenPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  if (
    typeof payload.access_token === "string"
    && typeof payload.refresh_token === "string"
    && typeof payload.token_type === "string"
  ) {
    return {
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
      token_type: payload.token_type,
    };
  }

  if (
    typeof payload.data?.access_token === "string"
    && typeof payload.data?.refresh_token === "string"
    && typeof payload.data?.token_type === "string"
  ) {
    return {
      access_token: payload.data.access_token,
      refresh_token: payload.data.refresh_token,
      token_type: payload.data.token_type,
    };
  }

  return null;
}

export async function POST() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;

  if (!refreshToken) {
    return NextResponse.json(
      {
        message: "Refresh token is missing",
      },
      { status: 401 },
    );
  }

  try {
    const backendResponse = await fetch(`${BACKEND_API_BASE_URL}/v1/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
    });

    const contentType = backendResponse.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await backendResponse.json()
      : await backendResponse.text();

    if (!backendResponse.ok) {
      if (payload && typeof payload === "object") {
        return NextResponse.json(payload, { status: backendResponse.status });
      }

      return NextResponse.json(
        {
          message: typeof payload === "string" && payload.trim()
            ? payload
            : "Token refresh failed",
        },
        { status: backendResponse.status },
      );
    }

    const tokenPayload = extractTokenPayload(payload);
    if (!tokenPayload) {
      return NextResponse.json(
        {
          message: "Refresh response is missing tokens",
        },
        { status: 502 },
      );
    }

    const response = NextResponse.json({
      success: true,
      status_code: 200,
      message: "Tokens refreshed successfully",
      data: null,
    });
    response.cookies.set(
      ACCESS_TOKEN_COOKIE,
      tokenPayload.access_token,
      buildCookieOptions(ACCESS_TOKEN_MAX_AGE_SECONDS),
    );
    response.cookies.set(
      REFRESH_TOKEN_COOKIE,
      tokenPayload.refresh_token,
      buildCookieOptions(REFRESH_TOKEN_MAX_AGE_SECONDS),
    );
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Token refresh failed",
      },
      { status: 500 },
    );
  }
}
