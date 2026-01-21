/**
 * Speech-to-Text (STT) Service
 * Supports OpenAI Whisper, Azure Speech, and DeepSeek
 */

import axios from "axios";

export interface STTOptions {
  audioData: Buffer;
  language?: string;
  prompt?: string;
}

export interface STTResult {
  text: string;
  language?: string;
  duration?: number;
  confidence?: number;
}

/**
 * Transcribe audio using OpenAI Whisper API
 */
async function transcribeWithOpenAI(options: STTOptions): Promise<STTResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OpenAI API key not configured");
  }

  const FormData = require("form-data");
  const form = new FormData();
  form.append("file", options.audioData, {
    filename: "audio.webm",
    contentType: "audio/webm",
  });
  form.append("model", "whisper-1");
  if (options.language) {
    form.append("language", options.language);
  }
  if (options.prompt) {
    form.append("prompt", options.prompt);
  }

  const response = await axios.post(
    "https://api.openai.com/v1/audio/transcriptions",
    form,
    {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${apiKey}`,
      },
    }
  );

  return {
    text: response.data.text,
    language: response.data.language,
  };
}

/**
 * Transcribe audio using Azure Speech API
 */
async function transcribeWithAzure(options: STTOptions): Promise<STTResult> {
  const apiKey = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION || "eastus";
  
  if (!apiKey) {
    throw new Error("Azure Speech API key not configured");
  }

  const language = options.language || "zh-CN";
  const endpoint = `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${language}`;

  const response = await axios.post(endpoint, options.audioData, {
    headers: {
      "Ocp-Apim-Subscription-Key": apiKey,
      "Content-Type": "audio/wav",
    },
  });

  return {
    text: response.data.DisplayText || response.data.NBest?.[0]?.Display || "",
    language: response.data.Language,
    confidence: response.data.NBest?.[0]?.Confidence,
  };
}

/**
 * Transcribe audio using DeepSeek (if they provide STT API)
 */
async function transcribeWithDeepSeek(options: STTOptions): Promise<STTResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DeepSeek API key not configured");
  }

  // Note: DeepSeek may not have STT API yet, this is a placeholder
  // If they provide STT API in the future, implement it here
  throw new Error("DeepSeek STT API not yet available");
}

/**
 * Main transcribe function with automatic fallback
 */
export async function transcribeAudio(options: STTOptions): Promise<STTResult> {
  const errors: Error[] = [];

  // Try OpenAI first
  if (process.env.OPENAI_API_KEY) {
    try {
      return await transcribeWithOpenAI(options);
    } catch (error) {
      errors.push(error as Error);
    }
  }

  // Try Azure as fallback
  if (process.env.AZURE_SPEECH_KEY) {
    try {
      return await transcribeWithAzure(options);
    } catch (error) {
      errors.push(error as Error);
    }
  }

  // Try DeepSeek as last resort
  if (process.env.DEEPSEEK_API_KEY) {
    try {
      return await transcribeWithDeepSeek(options);
    } catch (error) {
      errors.push(error as Error);
    }
  }

  throw new Error(
    `All STT services failed: ${errors.map((e) => e.message).join(", ")}`
  );
}

/**
 * Get supported languages
 */
export function getSupportedLanguages(): string[] {
  return [
    "zh-CN", // Chinese (Simplified)
    "zh-TW", // Chinese (Traditional)
    "en-US", // English (US)
    "en-GB", // English (UK)
    "ja-JP", // Japanese
    "ko-KR", // Korean
    "fr-FR", // French
    "de-DE", // German
    "es-ES", // Spanish
    "ru-RU", // Russian
  ];
}
