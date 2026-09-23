import { useEffect } from "react";
import { useLocale, type Locale } from "./index";
import { commonMessages } from "./messages";

export default function LocaleSelect() {
  const { locale, setLocale } = useLocale();
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = "Tubi · " + commonMessages[locale].workspace;
  }, [locale]);
  return <label className="locale-select">
    <span className="sr-only">{commonMessages[locale].language}</span>
    <select value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>
      <option value="kk" lang="kk">Қазақша</option>
      <option value="ru" lang="ru">Русский</option>
    </select>
  </label>;
}
