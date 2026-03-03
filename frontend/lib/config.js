export const BACKEND_API_BASE_URL =
  process.env.BACKEND_API_BASE_URL
  || process.env.NEXT_PUBLIC_API_URL
  || "http://localhost:8000/api";

export const PROXY_API_BASE_PATH = "/api/proxy";
export const AUTH_API_BASE_PATH = "/api/auth";
