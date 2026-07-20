const prefix = "jelo-care:";

export function save(key, value) {
  localStorage.setItem(prefix + key, JSON.stringify(value));
}

export function load(key, fallback = "") {
  const raw = localStorage.getItem(prefix + key);
  if (raw === null) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}