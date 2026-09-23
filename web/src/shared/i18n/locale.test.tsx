import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { getLocale, localeStorageKey, setLocale, useLocale } from "./index";

afterEach(() => { vi.restoreAllMocks(); setLocale("ru"); });

it("keeps the locale usable when browser storage is unavailable", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("storage blocked"); });
  const { result } = renderHook(useLocale);
  act(() => result.current.setLocale("kk"));
  expect(result.current.locale).toBe("kk");
});

it("synchronizes another tab and defaults unsupported saved values to Russian", () => {
  const { result } = renderHook(useLocale);
  act(() => {
    localStorage.setItem(localeStorageKey, "kk");
    window.dispatchEvent(new StorageEvent("storage", { key: localeStorageKey }));
  });
  expect(result.current.locale).toBe("kk");
  act(() => {
    localStorage.setItem(localeStorageKey, "en");
    window.dispatchEvent(new StorageEvent("storage", { key: localeStorageKey }));
  });
  expect(getLocale()).toBe("ru");
});
