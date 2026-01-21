/**
 * Text-to-Speech (TTS) Module
 * 文本转语音模块：使用浏览器原生Web Speech API或第三方TTS服务
 */

import axios from 'axios';

export interface TTSOptions {
  text: string;
  voice?: string;
  rate?: number; // 0.1 to 10, default 1
  pitch?: number; // 0 to 2, default 1
  volume?: number; // 0 to 1, default 1
  format?: 'mp3' | 'wav' | 'ogg';
}

export interface TTSResult {
  audioUrl?: string;
  audioData?: Buffer;
  duration?: number;
  error?: string;
}

/**
 * 使用OpenAI TTS API生成语音
 * 需要OPENAI_API_KEY环境变量
 */
export async function generateSpeechWithOpenAI(options: TTSOptions): Promise<TTSResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    return {
      error: 'OpenAI API key not configured',
    };
  }

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/audio/speech',
      {
        model: 'tts-1', // or 'tts-1-hd' for higher quality
        input: options.text,
        voice: options.voice || 'alloy', // alloy, echo, fable, onyx, nova, shimmer
        speed: options.rate || 1.0,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer',
      }
    );

    return {
      audioData: Buffer.from(response.data),
      duration: undefined, // OpenAI doesn't return duration
    };
  } catch (error: any) {
    console.error('[TTS] OpenAI TTS failed:', error.message);
    return {
      error: error.message || 'TTS generation failed',
    };
  }
}

/**
 * 使用DeepSeek或其他兼容的TTS API
 */
export async function generateSpeechWithDeepSeek(options: TTSOptions): Promise<TTSResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const apiUrl = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com';

  if (!apiKey) {
    return {
      error: 'DeepSeek API key not configured',
    };
  }

  try {
    // Note: DeepSeek may not have TTS API, this is a placeholder
    // Adjust according to actual API documentation
    const response = await axios.post(
      `${apiUrl}/v1/audio/speech`,
      {
        text: options.text,
        voice: options.voice || 'default',
        rate: options.rate || 1.0,
        pitch: options.pitch || 1.0,
        format: options.format || 'mp3',
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer',
        timeout: 30000,
      }
    );

    return {
      audioData: Buffer.from(response.data),
    };
  } catch (error: any) {
    console.error('[TTS] DeepSeek TTS failed:', error.message);
    return {
      error: error.message || 'TTS generation failed',
    };
  }
}

/**
 * 使用Microsoft Azure TTS
 */
export async function generateSpeechWithAzure(options: TTSOptions): Promise<TTSResult> {
  const apiKey = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION || 'eastus';

  if (!apiKey) {
    return {
      error: 'Azure Speech API key not configured',
    };
  }

  try {
    const ssml = `
      <speak version='1.0' xml:lang='zh-CN'>
        <voice xml:lang='zh-CN' name='${options.voice || 'zh-CN-XiaoxiaoNeural'}'>
          <prosody rate='${((options.rate || 1) - 1) * 100}%' pitch='${((options.pitch || 1) - 1) * 50}%'>
            ${options.text}
          </prosody>
        </voice>
      </speak>
    `;

    const response = await axios.post(
      `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
      ssml,
      {
        headers: {
          'Ocp-Apim-Subscription-Key': apiKey,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
        },
        responseType: 'arraybuffer',
        timeout: 30000,
      }
    );

    return {
      audioData: Buffer.from(response.data),
    };
  } catch (error: any) {
    console.error('[TTS] Azure TTS failed:', error.message);
    return {
      error: error.message || 'TTS generation failed',
    };
  }
}

/**
 * 主TTS函数 - 自动选择可用的TTS服务，带缓存支持
 */
export async function generateSpeech(options: TTSOptions): Promise<TTSResult> {
  const { generateCacheKey, getCachedAudio, setCachedAudio } = await import('./ttsCache');
  
  // 生成缓存键
  const cacheKey = generateCacheKey(
    options.text,
    options.voice || 'default',
    options.rate || 1.0,
    options.pitch || 1.0,
    options.format || 'mp3'
  );

  // 尝试从缓存中获取
  const cachedAudio = await getCachedAudio(cacheKey);
  if (cachedAudio) {
    console.log('[TTS] Using cached audio');
    return {
      audioData: cachedAudio,
    };
  }

  console.log('[TTS] Generating new audio');
  
  // 优先级：OpenAI > Azure > DeepSeek
  let result: TTSResult | null = null;
  
  // Try OpenAI first
  if (process.env.OPENAI_API_KEY) {
    result = await generateSpeechWithOpenAI(options);
    if (!result.error) {
      // 缓存生成的音频
      if (result.audioData) {
        await setCachedAudio(cacheKey, result.audioData, options.format || 'mp3', result.duration);
      }
      return result;
    }
  }

  // Try Azure
  if (process.env.AZURE_SPEECH_KEY) {
    result = await generateSpeechWithAzure(options);
    if (!result.error) {
      // 缓存生成的音频
      if (result.audioData) {
        await setCachedAudio(cacheKey, result.audioData, options.format || 'mp3', result.duration);
      }
      return result;
    }
  }

  // Try DeepSeek
  if (process.env.DEEPSEEK_API_KEY) {
    result = await generateSpeechWithDeepSeek(options);
    if (!result.error) {
      // 缓存生成的音频
      if (result.audioData) {
        await setCachedAudio(cacheKey, result.audioData, options.format || 'mp3', result.duration);
      }
      return result;
    }
  }

  // Fallback: return error if no service is available
  return {
    error: 'No TTS service configured. Please set OPENAI_API_KEY, AZURE_SPEECH_KEY, or DEEPSEEK_API_KEY.',
  };
}

/**
 * 获取可用的语音列表
 */
export function getAvailableVoices(): { id: string; name: string; language: string }[] {
  const voices: { id: string; name: string; language: string }[] = [];

  // OpenAI voices
  if (process.env.OPENAI_API_KEY) {
    voices.push(
      { id: 'alloy', name: 'Alloy (中性)', language: 'zh-CN' },
      { id: 'echo', name: 'Echo (男性)', language: 'zh-CN' },
      { id: 'fable', name: 'Fable (男性)', language: 'zh-CN' },
      { id: 'onyx', name: 'Onyx (男性)', language: 'zh-CN' },
      { id: 'nova', name: 'Nova (女性)', language: 'zh-CN' },
      { id: 'shimmer', name: 'Shimmer (女性)', language: 'zh-CN' }
    );
  }

  // Azure voices
  if (process.env.AZURE_SPEECH_KEY) {
    voices.push(
      { id: 'zh-CN-XiaoxiaoNeural', name: '晓晓 (女性)', language: 'zh-CN' },
      { id: 'zh-CN-YunxiNeural', name: '云希 (男性)', language: 'zh-CN' },
      { id: 'zh-CN-YunyangNeural', name: '云扬 (男性)', language: 'zh-CN' },
      { id: 'zh-CN-XiaoyiNeural', name: '晓伊 (女性)', language: 'zh-CN' },
      { id: 'zh-CN-YunjianNeural', name: '云健 (男性)', language: 'zh-CN' },
      { id: 'zh-CN-XiaochenNeural', name: '晓辰 (女性)', language: 'zh-CN' }
    );
  }

  return voices;
}

/**
 * 分段处理长文本
 * TTS API通常有字符限制，需要将长文本分段处理
 */
export function splitTextForTTS(text: string, maxLength: number = 4000): string[] {
  const segments: string[] = [];
  
  // 按段落分割
  const paragraphs = text.split(/\n+/);
  let currentSegment = '';

  for (const paragraph of paragraphs) {
    if (currentSegment.length + paragraph.length + 1 <= maxLength) {
      currentSegment += (currentSegment ? '\n' : '') + paragraph;
    } else {
      if (currentSegment) {
        segments.push(currentSegment);
      }
      
      // 如果单个段落超过限制，按句子分割
      if (paragraph.length > maxLength) {
        const sentences = paragraph.split(/([。！？.!?]+)/);
        let sentenceSegment = '';
        
        for (const sentence of sentences) {
          if (sentenceSegment.length + sentence.length <= maxLength) {
            sentenceSegment += sentence;
          } else {
            if (sentenceSegment) {
              segments.push(sentenceSegment);
            }
            sentenceSegment = sentence;
          }
        }
        
        if (sentenceSegment) {
          currentSegment = sentenceSegment;
        }
      } else {
        currentSegment = paragraph;
      }
    }
  }

  if (currentSegment) {
    segments.push(currentSegment);
  }

  return segments;
}
