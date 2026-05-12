import { config } from "dotenv";

config({ path: ".env.test" });

global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: async () => ({}),
  } as any),
) as any;
