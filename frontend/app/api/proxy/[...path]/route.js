import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { ACCESS_TOKEN_COOKIE } from "@/lib/auth";
import { BACKEND_API_BASE_URL } from "@/lib/config";


async function proxyRequest(request, pathSegments) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;

  if (!accessToken) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  const targetUrl = new URL(`${BACKEND_API_BASE_URL}/${pathSegments.join("/")}`);
  request.nextUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.append(key, value);
  });

  const headers = new Headers({
    Authorization: `Bearer ${accessToken}`,
  });

  let body;
  if (!["GET", "HEAD"].includes(request.method)) {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      body = await request.formData();
    } else {
      const rawBody = await request.text();
      if (rawBody) {
        body = rawBody;
      }
      if (contentType) {
        headers.set("Content-Type", contentType);
      }
    }
  }

  const backendResponse = await fetch(targetUrl.toString(), {
    method: request.method,
    headers,
    body,
    cache: "no-store",
  });

  const responseBody = await backendResponse.text();
  return new NextResponse(responseBody, {
    status: backendResponse.status,
    headers: {
      "content-type": backendResponse.headers.get("content-type") || "application/json",
    },
  });
}

export async function GET(request, context) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}

export async function POST(request, context) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}

export async function PUT(request, context) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}

export async function DELETE(request, context) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}
