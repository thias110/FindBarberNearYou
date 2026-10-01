import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MapTilerGeocoder,
  resolveGeocoder,
  setGeocoder,
} from "../../server/src/lib/geocoding";

afterEach(() => {
  vi.unstubAllGlobals();
  setGeocoder(null);
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("MapTilerGeocoder", () => {
  it("returns the first feature coordinates ([lon, lat])", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ features: [{ geometry: { coordinates: [6.14, 46.2] } }] }),
      ),
    );
    const geocoder = new MapTilerGeocoder("test-key");
    await expect(geocoder.geocode("Genève")).resolves.toEqual({
      latitude: 46.2,
      longitude: 6.14,
    });
  });

  it("throws ADDRESS_NOT_FOUND when there are no features", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ features: [] })),
    );
    const geocoder = new MapTilerGeocoder("test-key");
    await expect(geocoder.geocode("Nulle part")).rejects.toMatchObject({
      code: "ADDRESS_NOT_FOUND",
      status: 404,
    });
  });

  it("throws ADDRESS_NOT_FOUND for invalid coordinates", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ features: [{ geometry: { coordinates: [6.14, 91] } }] }),
      ),
    );
    const geocoder = new MapTilerGeocoder("test-key");
    await expect(geocoder.geocode("Hors carte")).rejects.toMatchObject({
      code: "ADDRESS_NOT_FOUND",
      status: 404,
    });
  });

  it("throws GEOCODING_UNAVAILABLE on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 500)));
    const geocoder = new MapTilerGeocoder("test-key");
    await expect(geocoder.geocode("Genève")).rejects.toMatchObject({
      code: "GEOCODING_UNAVAILABLE",
      status: 503,
    });
  });

  it("throws GEOCODING_UNAVAILABLE when fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const geocoder = new MapTilerGeocoder("test-key");
    await expect(geocoder.geocode("Genève")).rejects.toMatchObject({
      code: "GEOCODING_UNAVAILABLE",
      status: 503,
    });
  });
});

describe("setGeocoder / resolveGeocoder", () => {
  it("returns the injected geocoder", () => {
    const fake = { geocode: async () => ({ latitude: 0, longitude: 0 }) };
    setGeocoder(fake);
    expect(resolveGeocoder()).toBe(fake);
  });
});
