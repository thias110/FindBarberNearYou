export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function isUniqueViolation(err: unknown): boolean {
  let current: unknown = err;
  for (let depth = 0; current && depth < 5; depth += 1) {
    if (typeof current !== "object") break;
    const e = current as {
      code?: string;
      message?: string;
      detail?: string;
      cause?: unknown;
    };
    const text = `${e.code ?? ""} ${e.message ?? ""} ${e.detail ?? ""}`;
    if (
      e.code === "23505" ||
      /duplicate key|unique constraint|users_email_unique/i.test(text)
    ) {
      return true;
    }
    current = e.cause;
  }
  return false;
}
