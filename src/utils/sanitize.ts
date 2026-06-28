const DANGEROUS_CHARS = /[<>'"&]/g;
const MAX_TEXT_LEN = 500;

export function sanitizeText(value: unknown, maxLen = MAX_TEXT_LEN): string {
  if (typeof value !== "string") return "";
  return value.replace(DANGEROUS_CHARS, "").trim().slice(0, maxLen);
}

export function sanitizeUF(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 2);
}
