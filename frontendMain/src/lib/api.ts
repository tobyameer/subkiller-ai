const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
// Log base URL once for debugging CORS/fetch issues
// eslint-disable-next-line no-console
console.log("[api] BASE_URL configured:", BASE_URL);

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  // Ensure path starts with / if it doesn't already
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${BASE_URL}${normalizedPath}`;
  // eslint-disable-next-line no-console
  console.log("[api] request", url, options.method || "GET");
  
  let res: Response;
  try {
    res = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });
  } catch (fetchError: any) {
    // Network error (server down, CORS, connection refused, etc.)
    // eslint-disable-next-line no-console
    console.error("[api] network error", url, fetchError.message || fetchError);
    const backendUrl = BASE_URL;
    const error: any = new Error(
      `Backend not reachable. Is the server running on ${backendUrl}? Check the console for connection errors.`
    );
    error.status = 0;
    error.isNetworkError = true;
    error.url = url;
    throw error;
  }
  
  let data: any = null;
  try {
    const text = await res.text();
    if (text) {
      data = JSON.parse(text);
    }
  } catch (_) {
    data = null;
  }
  
  // Handle 401 Unauthorized - don't treat as error, just return null/empty
  if (res.status === 401) {
    // eslint-disable-next-line no-console
    console.log("[api] 401 Unauthorized (user not logged in)", url);
    const error: any = new Error("Unauthorized");
    error.status = 401;
    error.isUnauthorized = true;
    error.data = data;
    throw error;
  }
  
  if (!res.ok) {
    // eslint-disable-next-line no-console
    console.error("[api] http error", url, res.status, data);
    const message = data?.message || `Request failed: ${res.status}`;
    const error: any = new Error(message);
    error.status = res.status;
    error.isNetworkError = false; // HTTP error, not network error
    if (data?.code) error.code = data.code;
    error.data = data;
    throw error;
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: any) => request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: any) => request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  postForm: <T>(path: string, body: any) => request<T>(path, { method: "POST", body }),
};
