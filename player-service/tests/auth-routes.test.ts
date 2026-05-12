import bcrypt from "bcryptjs";
import type { NextFunction, Request, Response } from "express";
import request from "supertest";

jest.mock("../src/lib/prisma", () => ({
  prisma: {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("../src/lib/jwt", () => ({
  signToken: jest.fn(() => "mocked-jwt-token"),
}));

jest.mock("../src/middleware/auth", () => ({
  authMiddleware: (req: Request, _res: Response, next: NextFunction) => {
    req.user = {
      sub: "1",
      role: "USER",
      email: "test@test.com",
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
}));

const prismaMock = (jest.requireMock("../src/lib/prisma") as { prisma: any }).prisma;

let app: any;

beforeAll(async () => {
  const mod = await import("../src");
  app = mod.default;
});

describe("AUTH ROUTES", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /auth/register", () => {
    it("should register user", async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);

      prismaMock.user.create.mockResolvedValue({
        id: "1",
        email: "test@test.com",
        username: "test",
        role: "USER",
      });

      const res = await request(app).post("/auth/register").send({
        email: "test@test.com",
        username: "test",
        password: "password123",
      });

      expect(res.status).toBe(201);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe("test@test.com");
    });

    it("should reject duplicate user", async () => {
      prismaMock.user.findFirst.mockResolvedValue({
        id: "1",
      });

      const res = await request(app).post("/auth/register").send({
        email: "test@test.com",
        username: "test",
        password: "password123",
      });

      expect(res.status).toBe(409);
    });

    it("should reject short password", async () => {
      const res = await request(app).post("/auth/register").send({
        email: "test@test.com",
        username: "test",
        password: "123",
      });

      expect(res.status).toBe(400);
    });

    it("should reject missing fields", async () => {
      const res = await request(app).post("/auth/register").send({
        email: "test@test.com",
      });

      expect(res.status).toBe(400);
    });
  });

  describe("POST /auth/login", () => {
    it("should login user", async () => {
      const passwordHash = await bcrypt.hash("password123", 12);

      prismaMock.user.findUnique.mockResolvedValue({
        id: "1",
        email: "test@test.com",
        username: "test",
        role: "USER",
        isBanned: false,
        passwordHash,
      });

      const res = await request(app).post("/auth/login").send({
        email: "test@test.com",
        password: "password123",
      });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe("test@test.com");
    });

    it("should reject invalid credentials", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const res = await request(app).post("/auth/login").send({
        email: "test@test.com",
        password: "password123",
      });

      expect(res.status).toBe(401);
    });

    it("should reject banned user", async () => {
      const passwordHash = await bcrypt.hash("password123", 12);

      prismaMock.user.findUnique.mockResolvedValue({
        id: "1",
        email: "test@test.com",
        username: "test",
        role: "USER",
        isBanned: true,
        passwordHash,
      });

      const res = await request(app).post("/auth/login").send({
        email: "test@test.com",
        password: "password123",
      });

      expect(res.status).toBe(403);
    });
  });

  describe("POST /auth/google", () => {
    it("should create google user", async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);

      prismaMock.user.create.mockResolvedValue({
        id: "1",
        email: "google@test.com",
        username: "google_1234",
        role: "USER",
        googleId: "google-id",
        isBanned: false,
      });

      const res = await request(app).post("/auth/google").send({
        googleId: "google-id",
        email: "google@test.com",
        name: "Google User",
      });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe("google@test.com");
    });

    it("should reject missing googleId", async () => {
      const res = await request(app).post("/auth/google").send({
        email: "google@test.com",
      });

      expect(res.status).toBe(400);
    });

    it("should reject banned google user", async () => {
      prismaMock.user.findFirst.mockResolvedValue({
        id: "1",
        email: "google@test.com",
        username: "google",
        role: "USER",
        googleId: "google-id",
        isBanned: true,
      });

      const res = await request(app).post("/auth/google").send({
        googleId: "google-id",
        email: "google@test.com",
      });

      expect(res.status).toBe(403);
    });
  });

  describe("GET /auth/me", () => {
    it("should return current user", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: "1",
        email: "test@test.com",
        username: "test",
        role: "USER",
        isBanned: false,
        createdAt: new Date(),
      });

      const res = await request(app).get("/auth/me");

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe("test@test.com");
    });

    it("should return 404 when user not found", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const res = await request(app).get("/auth/me");

      expect(res.status).toBe(404);
    });
  });
});
