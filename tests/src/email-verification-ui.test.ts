import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../client/src/lib/apiClient";
import {
  INVALID_TOKEN_MESSAGE,
  NETWORK_MESSAGE,
  RATE_LIMITED_MESSAGE,
  runEmailVerification,
} from "../../client/src/lib/emailVerification";

describe("runEmailVerification", () => {
  it("résout en succès quand l'API valide le jeton", async () => {
    const verify = vi.fn().mockResolvedValue({ verified: true });
    await expect(runEmailVerification("abc", verify)).resolves.toEqual({
      phase: "success",
    });
    expect(verify).toHaveBeenCalledTimes(1);
    expect(verify).toHaveBeenCalledWith({ token: "abc" });
  });

  it("résout en erreur lisible quand l'API refuse le jeton", async () => {
    const verify = vi
      .fn()
      .mockRejectedValue(
        new ApiError(400, "INVALID_VERIFICATION_TOKEN", "Invalid or expired verification link."),
      );
    await expect(runEmailVerification("invalide", verify)).resolves.toEqual({
      phase: "error",
      message: INVALID_TOKEN_MESSAGE,
    });
  });

  it("distingue la limite de tentatives", async () => {
    const verify = vi
      .fn()
      .mockRejectedValue(new ApiError(429, "RATE_LIMITED", "Too many requests."));
    await expect(runEmailVerification("abc", verify)).resolves.toEqual({
      phase: "error",
      message: RATE_LIMITED_MESSAGE,
    });
  });

  it("signale une erreur réseau", async () => {
    const verify = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(runEmailVerification("abc", verify)).resolves.toEqual({
      phase: "error",
      message: NETWORK_MESSAGE,
    });
  });

  it("n'appelle pas l'API sans jeton", async () => {
    const verify = vi.fn();
    await expect(runEmailVerification(null, verify)).resolves.toEqual({
      phase: "error",
      message: INVALID_TOKEN_MESSAGE,
    });
    await expect(runEmailVerification("", verify)).resolves.toEqual({
      phase: "error",
      message: INVALID_TOKEN_MESSAGE,
    });
    expect(verify).not.toHaveBeenCalled();
  });
});
