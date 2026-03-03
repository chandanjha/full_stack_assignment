import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, USER_SNAPSHOT_COOKIE } from "@/lib/auth";
import { BACKEND_API_BASE_URL } from "@/lib/config";


export async function POST() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  let statusCode = 200;
  let message = "Logged out successfully";

  if (accessToken) {
    try {
      const backendResponse = await fetch(`${BACKEND_API_BASE_URL}/v1/auth/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      });
      statusCode = backendResponse.status;

      const contentType = backendResponse.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const payload = await backendResponse.json();
        message = payload.message || message;
      } else {
        const responseText = (await backendResponse.text()).trim();
        if (responseText) {
          message = responseText;
        }
      }
    } catch {
      // Local cookie cleanup should still complete if the backend token is already invalid.
    }
  }

  const response = NextResponse.json({
    success: true,
    status_code: statusCode,
    message,
    data: null,
  });
  response.cookies.delete(ACCESS_TOKEN_COOKIE);
  response.cookies.delete(REFRESH_TOKEN_COOKIE);
  response.cookies.delete(USER_SNAPSHOT_COOKIE);
  return response;
}
