import { config } from "dotenv";
import { vi } from "vitest";

config({ path: ".env.test" });

global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: async () => ({}),
  } as any),
);
