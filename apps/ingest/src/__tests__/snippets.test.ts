import { describe, it, expect } from "vitest";
import { countCodeSnippets } from "../snippets";

describe("countCodeSnippets", () => {
  it("counts fenced code blocks", () => {
    const md = "# Title\n```js\nconsole.log('hi')\n```\ntext\n```python\nprint('x')\n```\n";
    expect(countCodeSnippets(md)).toBe(2);
  });

  it("returns 0 for no code blocks", () => {
    expect(countCodeSnippets("just text")).toBe(0);
  });

  it("ignores unfenced code", () => {
    expect(countCodeSnippets("    indented code")).toBe(0);
  });
});
