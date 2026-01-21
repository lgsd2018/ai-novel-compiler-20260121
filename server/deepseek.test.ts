import { describe, expect, it } from "vitest";
import axios from "axios";

describe("DeepSeek API Key Validation", () => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const maybeIt = apiKey ? it : it.skip;

  maybeIt("should validate DeepSeek API key with a simple request", async () => {
    expect(apiKey).not.toBe("");

    // Make a simple API call to validate the key
    const response = await axios.post(
      "https://api.deepseek.com/v1/chat/completions",
      {
        model: "deepseek-chat",
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: "Say hello" },
        ],
        max_tokens: 10,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        timeout: 30000,
      }
    );

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty("choices");
    expect(response.data.choices.length).toBeGreaterThan(0);
  }, 60000); // 60 second timeout for API call
});
