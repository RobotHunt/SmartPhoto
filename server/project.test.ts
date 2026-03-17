import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(userId: number = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `test-user-${userId}`,
    email: `user${userId}@example.com`,
    name: `Test User ${userId}`,
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return ctx;
}

describe("project.create", () => {
  it("should create a new project with valid input", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.project.create({
      originalImageUrl: "https://example.com/test-image.jpg",
      originalImageKey: "test-user-1/uploads/test-image.jpg",
    });

    expect(result).toHaveProperty("projectId");
    expect(typeof result.projectId).toBe("number");
    expect(result.projectId).toBeGreaterThan(0);
  });
});

describe("project.update", () => {
  it("should update project with valid data", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // First create a project
    const createResult = await caller.project.create({
      originalImageUrl: "https://example.com/test-image.jpg",
      originalImageKey: "test-user-1/uploads/test-image.jpg",
    });

    // Then update it
    const updateResult = await caller.project.update({
      projectId: createResult.projectId,
      productName: "Test Product",
      platforms: "alibaba,jd",
      imageType: "main",
    });

    expect(updateResult).toEqual({ success: true });
  });
});

describe("project.get", () => {
  it("should retrieve project by id", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a project first
    const createResult = await caller.project.create({
      originalImageUrl: "https://example.com/test-image.jpg",
      originalImageKey: "test-user-1/uploads/test-image.jpg",
    });

    // Update with more data
    await caller.project.update({
      projectId: createResult.projectId,
      productName: "Test Product",
      platforms: "alibaba",
      imageType: "main",
    });

    // Retrieve the project
    const project = await caller.project.get({
      projectId: createResult.projectId,
    });

    expect(project).toBeDefined();
    expect(project?.id).toBe(createResult.projectId);
    expect(project?.productName).toBe("Test Product");
    expect(project?.platforms).toBe("alibaba");
    expect(project?.imageType).toBe("main");
  });

  it("should throw error when accessing another user's project", async () => {
    const ctx1 = createAuthContext(1);
    const caller1 = appRouter.createCaller(ctx1);

    // User 1 creates a project
    const createResult = await caller1.project.create({
      originalImageUrl: "https://example.com/test-image.jpg",
      originalImageKey: "test-user-1/uploads/test-image.jpg",
    });

    // User 2 tries to access it
    const ctx2 = createAuthContext(2);
    const caller2 = appRouter.createCaller(ctx2);

    await expect(
      caller2.project.get({ projectId: createResult.projectId })
    ).rejects.toThrow("Project not found");
  });
});

describe("project.list", () => {
  it("should return user's projects", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a project
    await caller.project.create({
      originalImageUrl: "https://example.com/test-image.jpg",
      originalImageKey: "test-user-1/uploads/test-image.jpg",
    });

    // List projects
    const projects = await caller.project.list();

    expect(Array.isArray(projects)).toBe(true);
    expect(projects.length).toBeGreaterThan(0);
  });
});
