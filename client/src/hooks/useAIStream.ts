import { useState, useCallback, useRef } from "react";

interface UseAIStreamOptions {
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
  typingSpeed?: number; // milliseconds per character
}

export function useAIStream(options: UseAIStreamOptions = {}) {
  const { onComplete, onError, typingSpeed = 30 } = options;
  const [streamedText, setStreamedText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const bufferRef = useRef<string>("");
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startTypingEffect = useCallback((text: string) => {
    let index = 0;
    setStreamedText("");
    setIsStreaming(true);

    intervalRef.current = setInterval(() => {
      if (index < text.length) {
        setStreamedText(text.substring(0, index + 1));
        index++;
      } else {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setIsStreaming(false);
        onComplete?.(text);
      }
    }, typingSpeed);
  }, [typingSpeed, onComplete]);

  const streamAI = useCallback(async (
    apiEndpoint: string,
    apiKey: string,
    prompt: string,
    context?: string
  ) => {
    try {
      setIsStreaming(true);
      setStreamedText("");
      bufferRef.current = "";

      abortControllerRef.current = new AbortController();

      const messages = [];
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
          temperature: 0.7,
          stream: true,
        }),
        signal: abortControllerRef.current.signal,
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
              setIsStreaming(false);
              onComplete?.(bufferRef.current);
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                bufferRef.current += content;
                setStreamedText(bufferRef.current);
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }

      setIsStreaming(false);
      onComplete?.(bufferRef.current);
    } catch (error: any) {
      if (error.name === "AbortError") {
        console.log("Stream aborted");
      } else {
        setIsStreaming(false);
        onError?.(error);
      }
    }
  }, [onComplete, onError]);

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const reset = useCallback(() => {
    stopStreaming();
    setStreamedText("");
    bufferRef.current = "";
  }, [stopStreaming]);

  return {
    streamedText,
    isStreaming,
    streamAI,
    startTypingEffect,
    stopStreaming,
    reset,
  };
}
