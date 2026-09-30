import { describe, expect, it } from "vitest";
import { ROLE_HOME } from "@findbarber/shared/constants";

describe("role home redirection", () => {
  it("redirects CLIENT to /", () => {
    expect(ROLE_HOME.CLIENT).toBe("/");
  });

  it("redirects BARBER to /pro/dashboard", () => {
    expect(ROLE_HOME.BARBER).toBe("/pro/dashboard");
  });

  it("redirects ADMIN to /admin", () => {
    expect(ROLE_HOME.ADMIN).toBe("/admin");
  });
});
