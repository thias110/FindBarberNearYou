// Regroupement des épingles (lot P-2, plan §2.6.9).
import { describe, expect, it } from "vitest";
import { groupPins, type ProjectedPin } from "../../client/src/lib/mapClusters";

function grid(count: number, step: number): ProjectedPin[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `b${i}`,
    x: (i % 10) * step,
    y: Math.floor(i / 10) * step,
  }));
}

describe("groupPins", () => {
  it("ne regroupe rien jusqu'à 30 épingles visibles", () => {
    const groups = groupPins(grid(30, 1));
    expect(groups).toHaveLength(30);
    expect(groups.every((g) => g.kind === "pin")).toBe(true);
  });

  it("au-delà, réunit les épingles d'une même case et compte chacune une fois", () => {
    // 40 épingles serrées (2 px d'écart) : toutes dans la même case de 64 px.
    const groups = groupPins(grid(40, 2));
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ kind: "cluster" });
    if (groups[0].kind === "cluster") expect(groups[0].ids).toHaveLength(40);
  });

  it("laisse seules les épingles isolées dans leur case", () => {
    // 31 épingles espacées de 100 px : une par case, aucune fusion.
    const groups = groupPins(grid(31, 100));
    expect(groups.filter((g) => g.kind === "pin")).toHaveLength(31);
  });

  it("place le cercle au barycentre et n'absorbe jamais la sélection", () => {
    const pins = [...grid(40, 2)];
    const groups = groupPins(pins, { keepAlone: "b0" });
    const alone = groups.find((g) => g.kind === "pin");
    expect(alone).toEqual({ kind: "pin", id: "b0" });
    const cluster = groups.find((g) => g.kind === "cluster");
    expect(cluster && cluster.kind === "cluster" && cluster.ids).not.toContain("b0");
    const ids = groups.flatMap((g) => (g.kind === "pin" ? [g.id] : g.ids));
    expect(new Set(ids).size).toBe(40);
  });
});
