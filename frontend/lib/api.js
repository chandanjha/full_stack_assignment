import { AUTH_API_BASE_PATH, PROXY_API_BASE_PATH } from "@/lib/config";


export class ApiRequestError extends Error {
  constructor(message, statusCode, fieldErrors = {}) {
    super(message);
    this.name = "ApiRequestError";
    this.statusCode = statusCode;
    this.fieldErrors = fieldErrors;
  }
}

async function parseJsonResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  throw new Error("Unexpected non-JSON response");
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

async function extractApiError(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const error = await response.json();
    const fieldErrors = toFieldErrors(error.errors);
    const message =
      error.errors?.[0]?.message
      || error.detail
      || error.message
      || "Request failed";
    return new ApiRequestError(message, response.status, fieldErrors);
  }

  const responseText = (await response.text()).trim();
  return new ApiRequestError(responseText || "Request failed", response.status);
}

async function request(basePath, path, init) {
  const response = await fetch(`${basePath}${path}`, {
    ...init,
    credentials: "include",
  });

  if (!response.ok) {
    throw await extractApiError(response);
  }

  return parseJsonResponse(response);
}

export class AuthAPI {
  static async login(credentials) {
    return request(AUTH_API_BASE_PATH, "/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(credentials),
    });
  }

  static async signup(data) {
    return request(AUTH_API_BASE_PATH, "/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
  }

  static async getProfile() {
    return request(PROXY_API_BASE_PATH, "/v1/auth/me", {
      method: "GET",
    });
  }

  static async logout() {
    return request(AUTH_API_BASE_PATH, "/logout", {
      method: "POST",
    });
  }
}

export class BooksAPI {
  static async listBooks(page = 1, pageSize = 20) {
    const query = new URLSearchParams({
      page: String(page),
      page_size: String(pageSize),
    });

    return request(PROXY_API_BASE_PATH, `/v1/books?${query.toString()}`, {
      method: "GET",
    });
  }

  static async createBook(input) {
    const formData = new FormData();
    formData.append("title", input.title);
    if (input.author) {
      formData.append("author", input.author);
    }
    if (input.tags) {
      formData.append("tags", input.tags);
    }
    formData.append("file", input.file);

    return request(PROXY_API_BASE_PATH, "/v1/books", {
      method: "POST",
      body: formData,
    });
  }

  static async borrowBook(bookId) {
    return request(PROXY_API_BASE_PATH, `/v1/books/${bookId}/borrow`, {
      method: "POST",
    });
  }

  static async returnBook(bookId) {
    return request(PROXY_API_BASE_PATH, `/v1/books/${bookId}/return`, {
      method: "POST",
    });
  }

  static async listReviews(bookId) {
    return request(PROXY_API_BASE_PATH, `/v1/books/${bookId}/reviews`, {
      method: "GET",
    });
  }

  static async createReview(bookId, input) {
    return request(PROXY_API_BASE_PATH, `/v1/books/${bookId}/reviews`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
  }

  static async getInsight(bookId) {
    return request(PROXY_API_BASE_PATH, `/v1/books/${bookId}/insight`, {
      method: "GET",
    });
  }

  static async getMyPreferences() {
    return request(PROXY_API_BASE_PATH, "/v1/books/preferences/me", {
      method: "GET",
    });
  }

  static async getRecommendations(limit = 5) {
    const query = new URLSearchParams({
      limit: String(limit),
    });

    return request(
      PROXY_API_BASE_PATH,
      `/v1/books/recommendations?${query.toString()}`,
      {
        method: "GET",
      },
    );
  }
}
