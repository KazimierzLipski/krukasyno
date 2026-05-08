import type { NextFunction, Request, Response } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
}));

vi.mock("../src/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("../src/middleware/auth", () => ({
  authMiddleware: (req: Request, _res: Response, next: NextFunction) => {
    req.user = {
      sub: "user-1",
      role: "ADMIN",
      email: "admin@test.com",
    };
    next();
  },

  requireAdmin: (_req: Request, _res: Response, next: NextFunction) => {
    next();
  },

  serviceKeyMiddleware: (req: Request, res: Response, next: NextFunction) => {
    const key = req.headers["x-service-key"];

    if (key !== process.env.SERVICE_API_KEY) {
      return res.status(403).json({ error: "Forbidden" });
    }

    next();
  },
}));

import app from "../src";

describe("USERS ROUTES", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /users/:id", () => {
    it("should return user for service-to-service request", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: "1",
        email: "a@a.com",
        username: "aaa",
        role: "USER",
        isBanned: false,
        createdAt: new Date(),
      });

      const res = await request(app)
        .get("/users/1")
        .set("x-service-key", "test-service-key");

      expect(res.status).toBe(200);

      expect(res.body.user.email).toBe("a@a.com");
      expect(res.body.user.username).toBe("aaa");
    });

    it("should return user for authenticated request", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: "1",
        email: "auth@test.com",
        username: "authuser",
        role: "USER",
        isBanned: false,
        createdAt: new Date(),
      });

      const res = await request(app).get("/users/1");

      expect(res.status).toBe(200);

      expect(res.body.user.email).toBe("auth@test.com");
    });

    it("should return 404 when user does not exist", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .get("/users/999")
        .set("x-service-key", "test-service-key");

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("User not found");
    });

    it("should return 500 on database error", async () => {
      prismaMock.user.findUnique.mockRejectedValue(new Error("database error"));

      const res = await request(app)
        .get("/users/1")
        .set("x-service-key", "test-service-key");

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Internal server error");
    });
  });

  describe("GET /users", () => {
    it("should return paginated users list", async () => {
      prismaMock.$transaction.mockResolvedValue([
        [
          {
            id: "1",
            email: "a@a.com",
            username: "aaa",
            role: "USER",
            isBanned: false,
            createdAt: new Date(),
          },
        ],
        1,
      ]);

      const res = await request(app)
        .get("/users")
        .set("x-service-key", "test-service-key");

      expect(res.status).toBe(200);

      expect(res.body.total).toBe(1);
      expect(res.body.users.length).toBe(1);
      expect(res.body.users[0].email).toBe("a@a.com");
    });

    it("should support pagination params", async () => {
      prismaMock.$transaction.mockResolvedValue([[], 0]);

      const res = await request(app)
        .get("/users?page=2&limit=10")
        .set("x-service-key", "test-service-key");

      expect(res.status).toBe(200);

      expect(res.body.page).toBe(2);
      expect(res.body.limit).toBe(10);
    });

    it("should reject request without service key", async () => {
      const res = await request(app).get("/users");

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Forbidden");
    });

    it("should return 500 on database error", async () => {
      prismaMock.$transaction.mockRejectedValue(new Error("database error"));

      const res = await request(app)
        .get("/users")
        .set("x-service-key", "test-service-key");

      expect(res.status).toBe(500);

      expect(res.body.error).toBe("Internal server error");
    });
  });
});
