import { getApiLocale, getLocale, type Locale } from "./i18n";
import { commonMessages } from "./i18n/messages";

export class ApiError extends Error {
  constructor(public code: string, public status?: number, public fields: string[] = []) {
    super(errorText(code, getLocale()));
    this.name = "ApiError";
  }
}

function errorText(code: string, locale: Locale) {
  const copy = commonMessages[locale];
  if (code === "NETWORK_ERROR") return copy.network;
  if (code === "VALIDATION_ERROR" || code === "HTTP_422") return copy.invalid;
  return copy.failure;
}

export function errorMessage(error: Error, locale: Locale) {
  return errorText(error instanceof ApiError ? error.code : "UNKNOWN_ERROR", locale);
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  headers.set("Accept-Language", getApiLocale());
  let response: Response;
  try {
    response = await fetch(`/api${path}`, { ...init, headers });
  } catch (cause) {
    if (init?.signal?.aborted || (cause && typeof cause === "object" && "name" in cause && cause.name === "AbortError")) throw cause;
    throw new ApiError("NETWORK_ERROR");
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(payload?.error?.code ?? `HTTP_${response.status}`, response.status, payload?.error?.fields ?? []);
  return payload as T;
}
export const json = (method: string, body: unknown): RequestInit => ({
  method, body: JSON.stringify(body),
});
