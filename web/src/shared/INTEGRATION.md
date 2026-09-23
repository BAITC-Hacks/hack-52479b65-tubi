# Общий frontend Tubi

## Языки

Обсуждение общего интерфейса: https://github.com/BAITC-Hacks/hack-52479b65-tubi/issues/1

В компонентах marketplace:

```tsx
import { useLocale, type Locale } from "../../shared/i18n";
import { messages } from "./locales";

const { locale, setLocale } = useLocale();
const copy = messages[locale];
```

- `Locale = "ru" | "kk" | "en"`. English согласован с заказчиком.
- Provider не нужен. Выбор хранится в `localStorage["tubi.locale"]`, при недоступном хранилище — в памяти.
- Переключатель уже находится в App. Не меняйте React key формы при смене языка.
- Словари marketplace храните в `features/marketplace/locales`, бизнес-словарь находится в `business/locales`.
- Переводите подписи и состояния, сохраняйте пользовательские строки.
- `request/json` из shared/http остаются совместимыми. HTTP-клиент сам добавляет `Accept-Language: kk` для kk, `ru` для ru и en.
- `ApiError` содержит code, status, fields; `errorMessage(error, locale)` локализует ошибку при отображении.
- В текущем main FastAPI ещё игнорирует Accept-Language, live AI генерирует вопросы на русском. UI обозначает язык полученного ответа; локализованы шаблонные вопросы fallback.
- Существующие exports shared/constants сохранены для совместимости. Их русские подписи можно постепенно заменить локальным словарём marketplace.

## Общие стили

`shared/styles.css` подключён один раз в main.tsx.

Токены: `--background`, `--surface`, `--ink`, `--muted`, `--accent`, `--line`.
Для видимых границ полей используйте `--control-border`: светлый `--line` предназначен для разделителей.
Старые `--purple` и `--purple-dark` сохранены как aliases акцента.

Общие классы: `button primary`, `button secondary`, `text-button`, `panel`, `field-hint`, `notice`, `error-box`, `sr-only`.
Размер текста формы 16px, область основных кнопок не меньше 44px, контур клавиатурного фокуса видимый.
Каждому input/textarea/select нужны label и стабильный id. Подсказку связывайте через aria-describedby.

## Тесты

```sh
cd web
npm ci
npm test
npm run build
```

Общая конфигурация: vitest.config.ts, jsdom, React Testing Library и user-event.
Setup shared/test/setup.ts подключает jest-dom и очистку DOM после каждого теста.
Тесты размещайте рядом с модулем в *.test.ts или *.test.tsx; новую конфигурацию создавать не нужно.
Node соответствует README: 22.12+. jsdom закреплён на совместимой ветке 26.
Vite использует configLoader runner, чтобы не собирать конфигурацию через esbuild в ограниченной Windows-среде.

## Бизнес-сценарий

useBusinessForm отвечает за состояние и жизненный цикл запросов; api.ts — за HTTP; компоненты — за отображение.
Рейтинг полностью приходит с сервера. ratingAdvice использует только разницу max − earned из breakdown.
Ответы хранятся при возврате и ошибках; compose не удаляет исходные вопросы.
Изменение карточки снимает подтверждение, а публикация выполняется после отдельного сохранения.
Устаревший evaluate блокируется счётчиком версии и AbortController.
