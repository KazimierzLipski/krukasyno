/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  globals: {
    "ts-jest": {
      tsconfig: "tests/tsconfig.json",
    },
  },
};
