import { pickLatestOcrRequestBlocks, sortOcrBlocksDeterministic, sortSelectedIdsByBlocks } from "./provenance";

describe("provenance helpers", () => {
  test("sortOcrBlocksDeterministic orders by bbox reading order then id", () => {
    const blocks = [
      { id: "b2", bbox: [10, 10, 20, 20], text: "x" },
      { id: "b1", bbox: [5, 10, 20, 20], text: "x" },
      { id: "b3", bbox: [5, 9, 20, 20], text: "x" },
      { id: "b0", bbox: null, text: "x" },
    ];
    const sorted = sortOcrBlocksDeterministic(blocks);
    expect(sorted.map((b) => b.id)).toEqual(["b3", "b1", "b2", "b0"]);
  });

  test("pickLatestOcrRequestBlocks filters to most recent request_id", () => {
    const blocks = [
      { id: "a1", request_id: "r1", created_at: "2024-01-01T00:00:00Z", bbox: [0, 0, 1, 1] },
      { id: "a2", request_id: "r1", created_at: "2024-01-01T00:00:01Z", bbox: [0, 0, 1, 1] },
      { id: "b1", request_id: "r2", created_at: "2024-01-02T00:00:00Z", bbox: [0, 0, 1, 1] },
    ];
    const { blocks: picked, requestId } = pickLatestOcrRequestBlocks(blocks);
    expect(requestId).toBe("r2");
    expect(picked.map((b) => b.id)).toEqual(["b1"]);
  });

  test("sortSelectedIdsByBlocks is stable and de-dupes", () => {
    const blocks = [
      { id: "b3" },
      { id: "b1" },
      { id: "b2" },
    ];
    expect(sortSelectedIdsByBlocks(["b2", "b1", "b1"], blocks)).toEqual(["b1", "b2"]);
  });
});

