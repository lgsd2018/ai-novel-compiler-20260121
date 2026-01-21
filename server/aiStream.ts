import { ENV } from "./_core/env";

/**
 * Stream AI response using Server-Sent Events (SSE)
 */
export async function streamAIResponse(params: {
  prompt: string;
  context?: string;
  apiKey: string;
  apiEndpoint?: string;
  temperature?: number;
  onChunk: (chunk: string) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
}) {
  const {
    prompt,
    context,
    apiKey,
    apiEndpoint = "https://api.deepseek.com/v1/chat/completions",
    temperature = 0.7,
    onChunk,
    onComplete,
    onError,
  } = params;

  try {
    const messages: Array<{ role: string; content: string }> = [];
    if (context) {
      messages.push({
        role: "system",
        content: "你是一个专业的小说创作助手，擅长根据上下文生成连贯、生动的故事内容。",
      });
      messages.push({
        role: "user",
        content: `以下是已有内容：\n\n${context}\n\n请根据以上内容，${prompt}`,
      });
    } else {
      messages.push({
        role: "user",
        content: prompt,
      });
    }

    const response = await fetch(apiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages,
        temperature,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.trim() === "") continue;
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") {
            onComplete();
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              onChunk(content);
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }

    onComplete();
  } catch (error) {
    onError(error as Error);
  }
}

/**
 * Batch generate multiple versions
 */
export async function batchGenerate(params: {
  prompt: string;
  context?: string;
  apiKey: string;
  apiEndpoint?: string;
  temperature?: number;
  count: number;
}): Promise<string[]> {
  const {
    prompt,
    context,
    apiKey,
    apiEndpoint = "https://api.deepseek.com/v1/chat/completions",
    temperature = 0.7,
    count,
  } = params;

  const messages: Array<{ role: string; content: string }> = [];
  if (context) {
    messages.push({
      role: "system",
      content: "你是一个专业的小说创作助手，擅长根据上下文生成连贯、生动的故事内容。",
    });
    messages.push({
      role: "user",
      content: `以下是已有内容：\n\n${context}\n\n请根据以上内容，${prompt}`,
    });
  } else {
    messages.push({
      role: "user",
      content: prompt,
    });
  }

  // Generate multiple versions in parallel
  const promises = Array.from({ length: count }, async () => {
    const response = await fetch(apiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages,
        temperature: temperature + Math.random() * 0.2, // Add variation
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  });

  return Promise.all(promises);
}
