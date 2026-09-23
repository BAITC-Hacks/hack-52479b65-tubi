import type {
  Card,
  CardField,
  Category,
  Level,
} from "../../../contracts/types";
export const categories: Record<Category, string> = {
  analytics: "Аналитика и AI",
  automation: "Автоматизация",
  education: "Образование",
  marketing: "Маркетинг",
  other: "Другое",
};
export const levels: Record<Level, string> = {
  draft: "Нужно уточнение",
  working: "Рабочая",
  ready: "Готова к работе",
  priority: "Приоритетная",
};
export const labels: Record<CardField, string> = {
  title: "Название задачи",
  context: "Что происходит сейчас",
  need: "Что нужно изменить",
  users: "Для кого решение",
  data: "Данные и материалы",
  expected_result: "Ожидаемый результат",
  success_criteria: "Критерии успеха",
  constraints: "Сроки и ограничения",
  contact: "Контакт бизнеса",
  interaction_format: "Как будем взаимодействовать",
};
export const ratingLabels: Record<string, string> = {
  context: "Контекст и потребность",
  data: "Данные и материалы",
  expected_result: "Результат",
  success_criteria: "Критерии успеха",
  constraints: "Ограничения",
  users: "Пользователи",
  communication: "Связь с бизнесом",
};
export const emptyCard: Card = {
  title: null,
  category: "analytics",
  context: null,
  need: null,
  users: null,
  data: null,
  expected_result: null,
  success_criteria: null,
  constraints: null,
  contact: null,
  interaction_format: null,
};
