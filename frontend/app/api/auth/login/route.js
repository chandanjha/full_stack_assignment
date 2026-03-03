import { NextResponse } from "next/server";

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

export async function POST(request) {
  try {
    const payload = await request.json();
    const backendResponse = await fetch(`${BACKEND_API_BASE_URL}/v1/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const responseBody = await backendResponse.text();
    const parsedBody = parseBackendPayload(responseBody);

    if (!backendResponse.ok) {
      if (parsedBody && typeof parsedBody === "object") {
        return NextResponse.json(parsedBody, {
          status: backendResponse.status,
        });
      }

      return NextResponse.json(
        {
          message: typeof parsedBody === "string" ? parsedBody : "Login failed",
        },
        { status: backendResponse.status },
      );
    }

    const loginResponse = extractLoginTokens(parsedBody);
    const loginUser = extractLoginUser(parsedBody);
    if (!loginResponse) {
      return NextResponse.json(
        { message: "Login response is missing tokens" },
        { status: 502 },
      );
    }

    const response = NextResponse.json({
      success: true,
      data: loginUser ? { user: loginUser } : null,
    });
    response.cookies.set(
      ACCESS_TOKEN_COOKIE,
      loginResponse.access_token,
      buildCookieOptions(ACCESS_TOKEN_MAX_AGE_SECONDS),
    );
    response.cookies.set(
      REFRESH_TOKEN_COOKIE,
      loginResponse.refresh_token,
      buildCookieOptions(REFRESH_TOKEN_MAX_AGE_SECONDS),
    );
    const serializedUserSnapshot = serializeUserSnapshot(loginUser);
    if (serializedUserSnapshot) {
      response.cookies.set(
        USER_SNAPSHOT_COOKIE,
        serializedUserSnapshot,
        buildCookieOptions(REFRESH_TOKEN_MAX_AGE_SECONDS),
      );
    } else {
      response.cookies.delete(USER_SNAPSHOT_COOKIE);
    }

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Login failed",
      },
      { status: 500 },
    );
  }
}
