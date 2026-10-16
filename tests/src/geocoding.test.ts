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

describe("MapTilerGeocoder.suggest (issue #45)", () => {
  it("returns labelled suggestions, skipping invalid features, with country and limit", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        features: [
          { place_name: "Rue du Rhône 1, Genève", geometry: { coordinates: [6.15, 46.2] } },
          { place_name: "Sans coordonnées", geometry: {} },
          { geometry: { coordinates: [6.1, 46.1] } },
          { place_name: "Rue du Rhône 1, Sion", geometry: { coordinates: [7.36, 46.23] } },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const geocoder = new MapTilerGeocoder("test-key");
    await expect(
      geocoder.suggest("Rue du Rhône 1", { countryCode: "CH", limit: 5 }),
    ).resolves.toEqual([
      { label: "Rue du Rhône 1, Genève", latitude: 46.2, longitude: 6.15 },
      { label: "Rue du Rhône 1, Sion", latitude: 46.23, longitude: 7.36 },
    ]);
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("autocomplete=true");
    expect(url).toContain("country=ch");
    expect(url).toContain("limit=5");
  });

  it("throws GEOCODING_UNAVAILABLE without echoing the query", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 500)));
    const geocoder = new MapTilerGeocoder("test-key");
    const error = await geocoder.suggest("Rue Secrète 9", { limit: 5 }).catch((e) => e);
    expect(error).toMatchObject({ code: "GEOCODING_UNAVAILABLE", status: 503 });
    expect(String(error.message)).not.toContain("Secrète");
  });
});

describe("setGeocoder / resolveGeocoder", () => {
  it("returns the injected geocoder", () => {
    const fake = { geocode: async () => ({ latitude: 0, longitude: 0 }) };
    setGeocoder(fake);
    expect(resolveGeocoder()).toBe(fake);
  });
});
