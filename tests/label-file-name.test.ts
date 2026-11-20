import { describe, expect, it } from "vitest";
import { labelFileName } from "../src/lib/orders/label";

describe("name of the saved label PDF", () => {
  it("is the customer's name and the order number", () => {
    expect(labelFileName([{ id: "LT-540680FC99C1", name: "Sara Ali" }])).toBe("Sara Ali LT-540680FC99C1");
  });
  it("names each label of a batch, and counts the rest after three", () => {
    const l = (n: number) => ({ id: `LT-00000000000${n}`, name: `Name${n}` });
    expect(labelFileName([l(1), l(2)])).toBe("Name1 LT-000000000001 - Name2 LT-000000000002");
    expect(labelFileName([l(1), l(2), l(3), l(4), l(5)])).toBe("Name1 LT-000000000001 - Name2 LT-000000000002 - Name3 LT-000000000003 +2");
  });
  it("keeps Arabic names and drops characters a file name can not hold", () => {
    expect(labelFileName([{ id: "LT-1", name: 'سارة / علي: "x"' }])).toBe("سارة علي x LT-1");
    expect(labelFileName([])).toBe("طباعة الملصقات");
  });
});
