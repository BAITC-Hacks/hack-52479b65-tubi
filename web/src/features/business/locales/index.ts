import type { CardField, Category, Level } from "../../../../../contracts/types";
import { useLocale, type Locale } from "../../../shared/i18n";

export type BusinessCopy = {
  steps: string[];
  title: string; intro: string; back: string; backToTasks: string; next: string;
  description: string; descriptionHint: string; descriptionPlaceholder: string;
  example: string; exampleText: string; category: string; clarify: string; clarifying: string;
  question: string; questionHint: string; answer: string; why: string; compose: string; composing: string;
  card: string; cardHint: string; titleHint: string; titleRequired: string; fieldPlaceholder: string;
  review: string; reviewHint: string; confirmation: string; save: string; saving: string;
  saved: string; savedHint: string; publish: string; publishing: string; published: string; publishedHint: string;
  view: string; edit: string; readiness: string; preview: string; calculating: string; nextImprovement: string;
  improvement: string; add: string; improve: string; complete: string; allFields: string; ratingUnavailable: string;
  retry: string; points: string; pendingHint: string; aiLive: string; aiDemo: string; aiLiveHint: string;
  aiDemoHint: string; aiWarnings: string; sourceLanguage: string;
  labels: Record<CardField, string>; reasons: Record<CardField, string>;
  categories: Record<Category, string>; levels: Record<Level, string>; ratingLabels: Record<string, string>;
};

const ru: BusinessCopy = {
  steps: ["Описание", "Уточнения", "Карточка", "Проверка", "Публикация"],
  title: "Подготовим задачу для команды", intro: "Добавляйте только известные вам сведения. Перед публикацией вы проверите карточку.",
  back: "Назад", backToTasks: "К задачам", next: "Далее", description: "Ваша задача",
  descriptionHint: "От 5 до 6000 символов. Опишите, что происходит сейчас и что хотите изменить.",
  descriptionPlaceholder: "Например: в нашей кофейне вручную читают отзывы гостей…", example: "Подставить пример",
  exampleText: "Мы вручную читаем отзывы гостей кофейни и хотим быстрее находить повторяющиеся проблемы.",
  category: "Направление задачи", clarify: "Перейти к вопросам", clarifying: "Готовим вопросы…",
  question: "Вопрос", questionHint: "Ответ станет частью карточки. Если сведения неизвестны, напишите об этом.",
  answer: "Ваш ответ", why: "Зачем это нужно", compose: "Собрать карточку", composing: "Собираем карточку…",
  card: "Проверьте и дополните карточку", cardHint: "Редактируйте текст своими словами. Неизвестные сведения можно оставить пустыми.",
  titleHint: "Коротко опишите, что нужно сделать.", titleRequired: "Для публикации нужно название от 3 символов.", fieldPlaceholder: "Добавьте известные вам сведения",
  review: "Проверить рейтинг и подтвердить", reviewHint: "Рейтинг показывает полноту описания. Опубликовать можно задачу с любым баллом.",
  confirmation: "Я проверил(а) карточку и подтверждаю указанные сведения.", save: "Подтвердить и сохранить", saving: "Сохраняем…",
  saved: "Карточка сохранена", savedHint: "Пока её видит только бизнес. Следующий шаг — опубликовать задачу для всех команд.",
  publish: "Опубликовать задачу", publishing: "Публикуем…", published: "Задача доступна командам",
  publishedHint: "Команды могут отправлять предложения. Вы сможете сравнить их и самостоятельно выбрать исполнителей.",
  view: "Открыть задачу", edit: "Вернуться к редактированию", readiness: "Готовность задачи", preview: "Предварительный рейтинг",
  calculating: "Обновляем рейтинг…", nextImprovement: "Следующее улучшение", improvement: "это может дать ещё {points} баллов",
  add: "Добавьте", improve: "Дополнить поле", complete: "Все разделы заполнены", allFields: "Проверьте точность сведений перед подтверждением.",
  ratingUnavailable: "Рейтинг пока недоступен. Данные карточки сохранены в форме.", retry: "Повторить расчёт", points: "баллов",
  pendingHint: "Изменение карточки снимает подтверждение. После правок проверьте её ещё раз.",
  aiLive: "AI сформировал ответ", aiDemo: "Деморежим", aiLiveHint: "Проверьте факты: AI может ошибаться.",
  aiDemoHint: "Используются шаблонные вопросы и ваши ответы. AI-генерация для этого шага недоступна.",
  aiWarnings: "Что нужно проверить", sourceLanguage: "Уже полученные вопросы и предупреждения сохранены на исходном языке. Ваши ответы не переведены.",
  labels: { title: "Название задачи", context: "Что происходит сейчас", need: "Что нужно изменить", users: "Для кого решение", data: "Данные и материалы", expected_result: "Ожидаемый результат", success_criteria: "Критерии успеха", constraints: "Сроки и ограничения", contact: "Контакт бизнеса", interaction_format: "Как будем взаимодействовать" },
  reasons: { title: "Помогает команде быстро понять задачу в каталоге.", context: "Команда поймёт исходную ситуацию и текущий процесс.", need: "Команда сосредоточится на нужном изменении.", users: "Помогает выбрать подходящий сценарий использования.", data: "Команда сможет оценить, с какими материалами можно начать работу.", expected_result: "Уточняет, что именно нужно передать вам в конце.", success_criteria: "Позволяет проверить результат по измеримому признаку.", constraints: "Помогает составить реалистичный план с учётом сроков и доступов.", contact: "Команда будет знать, кому задать вопросы.", interaction_format: "Помогает договориться о консультациях и обратной связи." },
  categories: { analytics: "Аналитика и AI", automation: "Автоматизация", education: "Образование", marketing: "Маркетинг", other: "Другое" },
  levels: { draft: "Нужно уточнение", working: "Рабочая", ready: "Готова к работе", priority: "Приоритетная" },
  ratingLabels: { context: "Контекст и потребность", data: "Данные и материалы", expected_result: "Результат", success_criteria: "Критерии успеха", constraints: "Ограничения", users: "Пользователи", communication: "Связь с бизнесом" },
};

const kk: BusinessCopy = {
  steps: ["Сипаттама", "Нақтылау", "Карточка", "Тексеру", "Жариялау"],
  title: "Командаға арналған тапсырманы дайындайық", intro: "Өзіңіз білетін мәліметтерді ғана қосыңыз. Жарияламас бұрын карточканы тексересіз.",
  back: "Артқа", backToTasks: "Тапсырмаларға", next: "Келесі", description: "Сіздің тапсырмаңыз",
  descriptionHint: "5–6000 таңба. Қазір не болып жатқанын және нені өзгерткіңіз келетінін жазыңыз.",
  descriptionPlaceholder: "Мысалы: біздің кофеханада қонақтардың пікірлерін қолмен оқиды…", example: "Мысалды енгізу",
  exampleText: "Біз кофехана қонақтарының пікірлерін қолмен оқимыз және қайталанатын мәселелерді жылдамырақ тапқымыз келеді.",
  category: "Тапсырма бағыты", clarify: "Сұрақтарға өту", clarifying: "Сұрақтар дайындалуда…",
  question: "Сұрақ", questionHint: "Жауап карточкаға қосылады. Мәлімет белгісіз болса, солай жазыңыз.",
  answer: "Сіздің жауабыңыз", why: "Бұл не үшін керек", compose: "Карточканы құрастыру", composing: "Карточка құрастырылуда…",
  card: "Карточканы тексеріп, толықтырыңыз", cardHint: "Мәтінді өз сөзіңізбен өңдеңіз. Белгісіз мәліметтерді бос қалдыруға болады.",
  titleHint: "Не істеу керегін қысқаша сипаттаңыз.", titleRequired: "Жариялау үшін кемінде 3 таңбадан тұратын атау қажет.", fieldPlaceholder: "Өзіңіз білетін мәліметтерді қосыңыз",
  review: "Рейтингті тексеру және растау", reviewHint: "Рейтинг сипаттаманың толықтығын көрсетеді. Кез келген баллмен жариялауға болады.",
  confirmation: "Карточканы тексердім және көрсетілген мәліметтерді растаймын.", save: "Растау және сақтау", saving: "Сақталуда…",
  saved: "Карточка сақталды", savedHint: "Әзірге оны тек бизнес көреді. Келесі қадам — тапсырманы барлық командаға жариялау.",
  publish: "Тапсырманы жариялау", publishing: "Жариялануда…", published: "Тапсырма командаларға қолжетімді",
  publishedHint: "Командалар ұсыныстарын жібере алады. Оларды салыстырып, орындаушыларды өзіңіз таңдайсыз.",
  view: "Тапсырманы ашу", edit: "Өңдеуге оралу", readiness: "Тапсырманың дайындығы", preview: "Алдын ала рейтинг",
  calculating: "Рейтинг жаңартылуда…", nextImprovement: "Келесі толықтыру", improvement: "бұл тағы {points} балл беруі мүмкін",
  add: "Қосыңыз", improve: "Өрісті толықтыру", complete: "Барлық бөлім толтырылған", allFields: "Растамас бұрын мәліметтердің дұрыстығын тексеріңіз.",
  ratingUnavailable: "Рейтинг әзірге қолжетімсіз. Карточка деректері формада сақталды.", retry: "Қайта есептеу", points: "балл",
  pendingHint: "Карточканы өзгерту растауды алып тастайды. Өңдеген соң қайта тексеріңіз.",
  aiLive: "Жауапты AI дайындады", aiDemo: "Деморежим", aiLiveHint: "Деректерді тексеріңіз: AI қателесуі мүмкін.",
  aiDemoHint: "Үлгі сұрақтар мен сіздің жауаптарыңыз қолданылады. Бұл қадамда AI генерациясы қолжетімсіз.",
  aiWarnings: "Нені тексеру керек", sourceLanguage: "Бұрын алынған сұрақтар мен ескертулер бастапқы тілінде сақталды. Жауаптарыңыз аударылған жоқ.",
  labels: { title: "Тапсырма атауы", context: "Қазіргі жағдай", need: "Нені өзгерту керек", users: "Шешім кімге арналған", data: "Деректер мен материалдар", expected_result: "Күтілетін нәтиже", success_criteria: "Табыс критерийлері", constraints: "Мерзімдер мен шектеулер", contact: "Бизнес байланысы", interaction_format: "Өзара әрекеттесу форматы" },
  reasons: { title: "Командаға каталогтағы тапсырманы тез түсінуге көмектеседі.", context: "Команда бастапқы жағдай мен қазіргі процесті түсінеді.", need: "Команда қажетті өзгеріске назар аударады.", users: "Тиісті пайдалану сценарийін таңдауға көмектеседі.", data: "Команда жұмысты қандай материалдармен бастай алатынын бағалайды.", expected_result: "Жұмыс соңында сізге не тапсыру керегін нақтылайды.", success_criteria: "Нәтижені өлшенетін көрсеткіш арқылы тексеруге мүмкіндік береді.", constraints: "Мерзімдер мен қолжетімділікті ескеріп, нақты жоспар құруға көмектеседі.", contact: "Команда сұрақтарды кімге қою керегін біледі.", interaction_format: "Кеңес беру мен кері байланыс туралы келісуге көмектеседі." },
  categories: { analytics: "Аналитика және AI", automation: "Автоматтандыру", education: "Білім беру", marketing: "Маркетинг", other: "Басқа" },
  levels: { draft: "Нақтылау қажет", working: "Жұмыс нұсқасы", ready: "Жұмысқа дайын", priority: "Басымдықты" },
  ratingLabels: { context: "Жағдай мен қажеттілік", data: "Деректер мен материалдар", expected_result: "Нәтиже", success_criteria: "Табыс критерийлері", constraints: "Шектеулер", users: "Пайдаланушылар", communication: "Бизнеспен байланыс" },
};

export const businessMessages: Record<Locale, BusinessCopy> = { ru, kk };
export function useBusinessCopy() { return businessMessages[useLocale().locale]; }
