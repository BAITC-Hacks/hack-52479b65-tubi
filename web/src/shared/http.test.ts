import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, errorMessage, json, request } from "./http";
import { getLocale, setLocale } from "./i18n";

afterEach(() => { vi.unstubAllGlobals(); setLocale("ru"); });
describe("shared HTTP and locale", () => {
  it.each([["ru", "ru"], ["kk", "kk"]] as const)("sends %s as API language %s and keeps the body unchanged", async (locale, apiLocale) => {
    setLocale(locale);
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal("fetch", fetchMock);
    const body = { description: "Менің деректерім" };
    await request("/tasks/evaluate", { ...json("POST", body), headers: new Headers({ "X-Request-Id": "example" }) });
    const options = fetchMock.mock.calls[0][1];
    expect(options.headers.get("Accept-Language")).toBe(apiLocale);
    expect(options.headers.get("X-Request-Id")).toBe("example");
    expect(JSON.parse(options.body)).toEqual(body);
    expect(getLocale()).toBe(locale);
    expect(localStorage.getItem("tubi.locale")).toBe(locale);
  });
  it("preserves AbortError for cancelled requests", async () => {
    const abort = new DOMException("Aborted", "AbortError");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abort));
    await expect(request("/tasks/evaluate")).rejects.toBe(abort);
  });
  it("localizes network and validation errors without dropping metadata", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { code: "VALIDATION_ERROR", message: "Ошибка сервера", fields: ["title"] },
    }), { status: 422 })));
    const error = await request("/tasks").catch((cause: ApiError) => cause);
    expect(error).toMatchObject({ code: "VALIDATION_ERROR", status: 422, fields: ["title"] });
    expect(errorMessage(error as ApiError, "ru")).toBe("Ошибка сервера");
    expect(errorMessage(error as ApiError, "kk")).toBe("Енгізілген деректерді тексеріп, әрекетті қайталаңыз.");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(request("/health")).rejects.toMatchObject({ code: "NETWORK_ERROR" });
  });
  it("keeps a server conflict explanation in the language of its request", async () => {
    let finish!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => new Promise((resolve) => { finish = resolve; })));
    setLocale("ru");
    const pending = request("/proposals/example").catch((cause: ApiError) => cause);
    setLocale("kk");
    finish(new Response(JSON.stringify({ error: { code: "HTTP_409", message: "Решение уже принято.", fields: [] } }), { status: 409 }));
    const error = await pending as ApiError;
    expect(errorMessage(error, "ru")).toBe("Решение уже принято.");
    expect(errorMessage(error, "kk")).not.toBe("Решение уже принято.");
  });
  it("rejects an invalid success response instead of passing null to components", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not json")));
    await expect(request("/tasks")).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
});
