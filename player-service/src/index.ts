import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import { adminRouter } from "./routes/admin";
import { authRouter } from "./routes/auth";
import { usersRouter } from "./routes/users";


const app = express();
const PORT = parseInt(process.env.PORT ?? "5000", 10);

// ── Middleware ────────────────────────────────────────
app.use(helmet());
app.use(
  cors({ origin: "*", methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"] }),
);
app.use(express.json());
app.use(morgan("combined"));

// ── Health ────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "player-service",
    timestamp: new Date().toISOString(),
  });
});

// ── Routes ────────────────────────────────────────────
app.use("/auth", authRouter);
app.use("/users", usersRouter);
app.use("/admin", adminRouter);

// ── Start ─────────────────────────────────────────────
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[player-service] Listening on port ${PORT}`);
  });
}

export default app;
