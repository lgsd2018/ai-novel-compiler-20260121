import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// 基础环境变量配置
const baseEnv = {
  appId: "",
  cookieSecret: "",
  databaseUrl: "",
  oAuthServerUrl: "",
  ownerOpenId: "",
  isProduction: false,
  forgeApiUrl: "",
  forgeApiKey: "",
  multiAgentEnabled: false,
};

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
});

describe("proxy mode configuration", () => {
  it("uses forge proxy base url and api key for data api", async () => {
    // 验证数据代理请求是否使用内置代理配置
    vi.doMock("./_core/env", () => ({
      ENV: {
        ...baseEnv,
        forgeApiUrl: "https://forge.example.com",
        forgeApiKey: "forge-key",
      },
    }));
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ jsonData: JSON.stringify({ ok: true }) }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { callDataApi } = await import("./_core/dataApi");
    const result = await callDataApi("Youtube/search", {
      query: { q: "test" },
    });

    expect(result).toEqual({ ok: true });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://forge.example.com/webdevtoken.v1.WebDevService/CallApi"
    );
    expect(options.headers.authorization).toBe("Bearer forge-key");
  });

  it("uses forge proxy base url and api key for maps", async () => {
    // 验证地图代理请求是否使用内置代理配置
    vi.doMock("./_core/env", () => ({
      ENV: {
        ...baseEnv,
        forgeApiUrl: "https://forge.example.com/",
        forgeApiKey: "maps-key",
      },
    }));
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ status: "OK" }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { makeRequest } = await import("./_core/map");
    const result = await makeRequest("/maps/api/geocode/json", {
      address: "Shanghai",
    });

    expect(result).toEqual({ status: "OK" });
    const [url] = fetchMock.mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.origin).toBe("https://forge.example.com");
    expect(parsed.pathname).toBe("/v1/maps/proxy/maps/api/geocode/json");
    expect(parsed.searchParams.get("key")).toBe("maps-key");
    expect(parsed.searchParams.get("address")).toBe("Shanghai");
  });

  it("fails fast when storage proxy config missing", async () => {
    // 验证存储代理缺失配置时快速失败
    vi.doMock("./_core/env", () => ({
      ENV: {
        ...baseEnv,
        forgeApiUrl: "",
        forgeApiKey: "",
      },
    }));

    const { storagePut } = await import("./storage");
    await expect(storagePut("a.txt", "data")).rejects.toThrow(
      "Storage proxy credentials missing"
    );
  });
});
