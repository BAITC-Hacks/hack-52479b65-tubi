export function readTaskId() {
  return new URL(window.location.href).searchParams.get("task") || null;
}

export function writeTaskLocation(taskId: string | null) {
  const url = new URL(window.location.href);
  if (taskId) url.searchParams.set("task", taskId);
  else url.searchParams.delete("task");
  url.hash = "";
  if (url.href !== window.location.href) window.history.pushState(null, "", url);
}
