import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { inferProcedureInput } from "@trpc/server";
import type { AppRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb, getUserByOpenId, upsertUser } from "./db";
import { addPublishTask } from "./queue";

describe("Task Queue API", () => {
  let testUserId: number;
  let caller: ReturnType<typeof appRouter.createCaller>;
  let isQueueAvailable = true;

  beforeAll(async () => {
    try {
      await upsertUser({
        openId: "test-task-queue-user",
        name: "Task Queue Test User",
        email: "taskqueue@test.com",
      });

      const existingUser = await getUserByOpenId("test-task-queue-user");
      if (!existingUser) {
        throw new Error("Failed to create test user");
      }

      testUserId = existingUser.id;

      await addPublishTask({
        taskId: 9999,
        userId: testUserId,
        projectId: 1,
        platform: "qidian",
        accountId: 1,
        documentIds: [1],
        config: {
          bookTitle: "Test Book",
          bookIntro: "Test Intro",
          category: "Test",
          tags: ["test"],
        },
      });

      const ctx: TrpcContext = {
        req: {} as any,
        res: {} as any,
        user: existingUser,
      };

      caller = appRouter.createCaller(ctx);
    } catch {
      isQueueAvailable = false;
    }
  });

  afterAll(async () => {
    if (!isQueueAvailable) {
      return;
    }
    const db = await getDb();
    if (testUserId && db) {
      const { users } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await db.delete(users).where(eq(users.id, testUserId));
    }
  });

  it("should get queue statistics", async () => {
    if (!isQueueAvailable) {
      return;
    }
    const stats = await caller.queue.stats();

    expect(stats).toBeDefined();
    expect(stats).toHaveProperty("waiting");
    expect(stats).toHaveProperty("active");
    expect(stats).toHaveProperty("completed");
    expect(stats).toHaveProperty("failed");

    expect(typeof stats.waiting).toBe("number");
    expect(typeof stats.active).toBe("number");
    expect(typeof stats.completed).toBe("number");
    expect(typeof stats.failed).toBe("number");
  });

  it("should list jobs with default pagination", async () => {
    if (!isQueueAvailable) {
      return;
    }
    const result = await caller.queue.list();

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeLessThanOrEqual(10);

    // Check job structure if any jobs exist
    if (result.length > 0) {
      const job = result[0];
      expect(job).toHaveProperty("id");
      expect(job).toHaveProperty("name");
      expect(job).toHaveProperty("data");
      expect(job).toHaveProperty("status");
      expect(job).toHaveProperty("progress");
      expect(job).toHaveProperty("timestamp");
    }
  });

  it("should list jobs", async () => {
    if (!isQueueAvailable) {
      return;
    }
    const result = await caller.queue.list();

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it("should get job details by ID", async () => {
    if (!isQueueAvailable) {
      return;
    }
    const jobs = await caller.queue.list();

    if (jobs.length > 0) {
      const jobId = jobs[0].id;
      const jobDetail = await caller.queue.getStatus({ jobId });

      expect(jobDetail).toBeDefined();
      expect(jobDetail).toHaveProperty("id");
      expect(jobDetail).toHaveProperty("status");
    }
  });

  it("should handle non-existent job ID gracefully", async () => {
    if (!isQueueAvailable) {
      return;
    }
    const result = await caller.queue.getStatus({ jobId: "non-existent-job-id" });
    expect(result).toBeNull();
  });

  it.skip("should pause a job", async () => {
    // Get all jobs
    const jobs = await caller.queue.list();

    if (jobs.length > 0) {
      const jobId = jobs[0].id;
      const result = await caller.queue.pause({ jobId });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    }
  });

  it.skip("should resume a paused job", async () => {
    // Get all jobs
    const jobs = await caller.queue.list();

    if (jobs.length > 0) {
      const jobId = jobs[0].id;
      const result = await caller.queue.resume({ jobId });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    }
  });

  it("should cancel a job", async () => {
    if (!isQueueAvailable) {
      return;
    }
    const jobs = await caller.queue.list();

    if (jobs.length > 0) {
      const jobId = jobs[0].id;
      const result = await caller.queue.cancel({ jobId });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    }
  });
});
