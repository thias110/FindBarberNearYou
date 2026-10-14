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

/** Violation d'une contrainte d'exclusion PostgreSQL (SQLSTATE 23P01). */
export function isExclusionViolation(err: unknown): boolean {
  let current: unknown = err;
  for (let depth = 0; current && depth < 5; depth += 1) {
    if (typeof current !== "object") break;
    const e = current as { code?: string; message?: string; cause?: unknown };
    if (
      e.code === "23P01" ||
      /conflicting key value violates exclusion constraint/i.test(e.message ?? "")
    ) {
      return true;
    }
    current = e.cause;
  }
  return false;
}
