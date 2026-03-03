import { NextResponse } from "next/server";

import { BACKEND_API_BASE_URL } from "@/lib/config";


export async function POST(request) {
  const payload = await request.text();
  const backendResponse = await fetch(`${BACKEND_API_BASE_URL}/v1/auth/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: payload,
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
