import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { getAppConfig } from "../src/lib/config";
import { createTestEnv } from "./helpers";

describe("config", () => {
  it("parses and normalizes runtime env settings", () => {
    const config = getAppConfig(
      createTestEnv({
        CORS_ORIGIN: "https://app.example.com, http://localhost:5173",
      })
    );

    expect(config).toEqual({
      corsOrigins: ["https://app.example.com", "http://localhost:5173"],
      appBaseUrl: "http://localhost:5173",
    });
  });

  it("accepts an explicit app base url", () => {
    const config = getAppConfig(
      createTestEnv({
        APP_BASE_URL: "https://starter.example.com",
      })
    );

    expect(config.appBaseUrl).toBe("https://starter.example.com");
  });

  it("rejects invalid origin strings early", () => {
    expect(() =>
      getAppConfig(
        createTestEnv({
          CORS_ORIGIN: "https://app.example.com/path",
        })
      )
    ).toThrow(ZodError);
  });
});
