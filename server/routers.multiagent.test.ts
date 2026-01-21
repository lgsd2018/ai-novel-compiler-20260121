import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./aiAgents", () => ({
  multiAgentInteract: vi.fn(),
  getMultiAgentTrace: vi.fn(),
}));

vi.mock("./db/agentLogsDb", () => ({
  createAgentLog: vi.fn(),
  getAgentLogs: vi.fn(),
  updateAgentLogStatus: vi.fn(),
}));

vi.mock("./db", () => ({
  createChatMessage: vi.fn(),
}));

import { appRouter } from "./routers";
import { multiAgentInteract } from "./aiAgents";
import { createAgentLog } from "./db/agentLogsDb";

function createAuthContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "sample-user",
      email: "sample@example.com",
      name: "Sample User",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("ai.agentInteract multi-agent integration", () => {
  it("returns logId when modify_file action is produced", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    vi.mocked(multiAgentInteract).mockResolvedValue({
      action: {
        type: "modify_file",
        filePath: "note.txt",
        originalContent: "A",
        newContent: "B",
        reason: "test",
      },
      trace: [],
      requestId: "req-1",
    });
    vi.mocked(createAgentLog).mockResolvedValue(9 as any);

    const result = await caller.ai.agentInteract({
      modelConfigId: 1,
      projectId: 2,
      message: "test",
      useMultiAgent: true,
      currentFile: { path: "note.txt", content: "A" },
      history: [],
    });

    expect(result.logId).toBe(9);
    expect(result.trace).toEqual([]);
    expect(result.requestId).toBe("req-1");
  });
});
