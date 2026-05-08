import type { NextFunction, Request, Response } from "express";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  $transaction: vi.fn(),
  user: {
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
};

vi.mock("../src/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("../src/middleware/auth", async () => {
  return {
    authMiddleware: (req: Request, _res: Response, next: NextFunction) => {
      req.user = {
        sub: "admin-id",
        role: "ADMIN",
        email: "admin@gmail.com",
      };

      next();
    },

    requireAdmin: (_req: Request, _res: Response, next: NextFunction) => {
      next();
    },

    serviceKeyMiddleware: (
      _req: Request,
      _res: Response,
      next: NextFunction,
    ) => {
      next();
    },
  };
});

let app: any;

beforeAll(async () => {
  const mod = await import("../src");
  app = mod.default;
});

describe("ADMIN ROUTES", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /admin/users", async () => {
    prismaMock.$transaction.mockResolvedValue([
      [
        {
          id: "1",
          email: "test@test.com",
          username: "test",
          role: "USER",
          isBanned: false,
          createdAt: new Date(),
        },
      ],
      1,
    ]);

    const res = await request(app).get("/admin/users");

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.users.length).toBe(1);
    expect(res.body.users[0].email).toBe("test@test.com");
  });

  it("POST /admin/users/:id/ban", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "1",
      role: "USER",
    });

    prismaMock.user.update.mockResolvedValue({
      id: "1",
      email: "a@a.com",
      username: "aaa",
      isBanned: true,
    });

    const res = await request(app).post("/admin/users/1/ban");

    expect(res.status).toBe(200);
    expect(res.body.user.isBanned).toBe(true);
  });

  it("POST /admin/users/:id/unban", async () => {
    prismaMock.user.update.mockResolvedValue({
      id: "1",
      email: "a@a.com",
      username: "aaa",
      isBanned: false,
    });

    const res = await request(app).post("/admin/users/1/unban");

    expect(res.status).toBe(200);
    expect(res.body.user.isBanned).toBe(false);
  });

  it("PUT /admin/users/:id/role", async () => {
    prismaMock.user.update.mockResolvedValue({
      id: "1",
      email: "a@a.com",
      username: "aaa",
      role: "ADMIN",
    });

    const res = await request(app).put("/admin/users/1/role").send({
      role: "ADMIN",
    });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("ADMIN");
  });

  it("should reject invalid role", async () => {
    const res = await request(app).put("/admin/users/1/role").send({
      role: "SUPERADMIN",
    });

    expect(res.status).toBe(400);
  });

  it("should reject banning admin", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "1",
      role: "ADMIN",
    });

    const res = await request(app).post("/admin/users/1/ban");

    expect(res.status).toBe(400);
  });

  it("should return 404 when user not found", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const res = await request(app).post("/admin/users/1/ban");

    expect(res.status).toBe(404);
  });

  it("should prevent self demotion", async () => {
    const res = await request(app).put("/admin/users/admin-id/role").send({
      role: "USER",
    });

    expect(res.status).toBe(400);
  });
});
