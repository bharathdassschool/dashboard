/** Trimmed text from a form, cut to `max` characters. */
export function str(fd: FormData, key: string, max = 500) {
  return String(fd.get(key) ?? "").trim().slice(0, max);
}

/** A positive whole number from a form, or an error. */
export function id(fd: FormData, key = "id") {
  const n = Number(fd.get(key));
  if (!Number.isInteger(n) || n <= 0) throw new Error("Something went wrong – reload the page and try again.");
  return n;
}

export function ids(fd: FormData, key: string) {
  return fd.getAll(key).map(Number).filter((n) => Number.isInteger(n) && n > 0);
}
