import { describe, expect, it, vi } from "vitest";

vi.mock("./ai", () => ({
  generateWithAI: vi.fn(),
}));

import { generateWithAI } from "./ai";
import { getMultiAgentTrace, multiAgentInteract } from "./aiAgents";

const generateMock = vi.mocked(generateWithAI);

const makeResult = (content: string) => ({
  content,
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
  cost: 0,
});

describe("multiAgentInteract", () => {
  it("returns reviewer modify result with trace and requestId", async () => {
    generateMock
      .mockResolvedValueOnce(
        makeResult(
          JSON.stringify({
            type: "chat",
            message: "Plan: ...",
          })
        )
      )
      .mockResolvedValueOnce(
        makeResult(
          JSON.stringify({
            type: "modify_file",
            filePath: "a.txt",
            originalContent: "A",
            newContent: "B",
            reason: "writer",
          })
        )
      )
      .mockResolvedValueOnce(
        makeResult(
          JSON.stringify({
            type: "modify_file",
            filePath: "a.txt",
            originalContent: "A",
            newContent: "B2",
            reason: "editor",
          })
        )
      )
      .mockResolvedValueOnce(
        makeResult(
          JSON.stringify({
            type: "modify_file",
            filePath: "a.txt",
            originalContent: "A",
            newContent: "B3",
            reason: "reviewer",
          })
        )
      );

    const result = await multiAgentInteract(1, 2, 3, "test", {
      path: "a.txt",
      content: "A",
    });

    expect(result.action.type).toBe("modify_file");
    expect(result.trace).toHaveLength(4);
    expect(result.requestId).toMatch(/3-/);
    const stored = getMultiAgentTrace(result.requestId);
    expect(stored?.trace).toHaveLength(4);
  });

  it("falls back to editor modify action when reviewer returns chat", async () => {
    generateMock
      .mockResolvedValueOnce(
        makeResult(
          JSON.stringify({
            type: "chat",
            message: "Plan: ...",
          })
        )
      )
      .mockResolvedValueOnce(
        makeResult(
          JSON.stringify({
            type: "modify_file",
            filePath: "b.txt",
            originalContent: "X",
            newContent: "Y",
            reason: "writer",
          })
        )
      )
      .mockResolvedValueOnce(
        makeResult(
          JSON.stringify({
            type: "modify_file",
            filePath: "b.txt",
            originalContent: "X",
            newContent: "Y2",
            reason: "editor",
          })
        )
      )
      .mockResolvedValueOnce(
        makeResult(
          JSON.stringify({
            type: "chat",
            message: "不通过",
          })
        )
      );

    const result = await multiAgentInteract(1, 2, 3, "test", {
      path: "b.txt",
      content: "X",
    });

    expect(result.action.type).toBe("modify_file");
    expect(result.action.newContent).toBe("Y2");
  });

  it("completes within a small baseline time window", async () => {
    generateMock
      .mockResolvedValueOnce(makeResult(`{"type":"chat","message":"plan"}`))
      .mockResolvedValueOnce(makeResult(`{"type":"chat","message":"ok"}`))
      .mockResolvedValueOnce(makeResult(`{"type":"chat","message":"ok"}`))
      .mockResolvedValueOnce(makeResult(`{"type":"chat","message":"ok"}`));

    const start = Date.now();
    await multiAgentInteract(1, 2, 3, "test");
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(50);
  });
});
