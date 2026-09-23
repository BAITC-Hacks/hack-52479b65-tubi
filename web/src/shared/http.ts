export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new Error(
      "Сервер недоступен. Запустите backend и повторите действие.",
    );
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      payload?.error?.message ||
        `Не удалось выполнить запрос (${response.status}).`,
    );
  return payload as T;
}
export const json = (method: string, body: unknown): RequestInit => ({
  method,
  body: JSON.stringify(body),
});
