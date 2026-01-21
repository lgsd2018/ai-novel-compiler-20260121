/**
 * Streaming Speech Recognition WebSocket Service
 * 实时流式语音识别WebSocket服务
 */

import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import axios from 'axios';
import { detectLanguage, getLanguageName, getLanguageConfidence } from './languageDetection';

interface StreamingSession {
  ws: WebSocket;
  userId: number;
  audioBuffer: Buffer[];
  isProcessing: boolean;
  lastProcessedTime: number;
  language: string;
}

const sessions = new Map<string, StreamingSession>();

// 音频缓冲配置
const BUFFER_SIZE_THRESHOLD = 64 * 1024; // 64KB
const PROCESS_INTERVAL = 1000; // 1秒

/**
 * 初始化WebSocket服务器
 */
export function initStreamingSpeechRecognitionWS(server: Server) {
  const wss = new WebSocketServer({ 
    server,
    path: '/ws/speech-recognition'
  });

  wss.on('connection', (ws: WebSocket, req) => {
    const sessionId = generateSessionId();
    console.log(`[Streaming Speech] New connection: ${sessionId}`);

    // 从查询参数获取用户信息
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const userId = parseInt(url.searchParams.get('userId') || '0');
    const language = url.searchParams.get('language') || 'zh';

    if (!userId) {
      ws.send(JSON.stringify({ type: 'error', message: 'Missing userId' }));
      ws.close();
      return;
    }

    // 创建会话
    const session: StreamingSession = {
      ws,
      userId,
      audioBuffer: [],
      isProcessing: false,
      lastProcessedTime: Date.now(),
      language,
    };
    sessions.set(sessionId, session);

    // 发送连接成功消息
    ws.send(JSON.stringify({ type: 'connected', sessionId }));

    // 处理音频数据
    ws.on('message', async (data: Buffer) => {
      try {
        if (data.toString() === 'ping') {
          ws.send('pong');
          return;
        }

        // 将音频数据添加到缓冲区
        session.audioBuffer.push(data);

        // 检查是否需要处理
        const totalSize = session.audioBuffer.reduce((sum, buf) => sum + buf.length, 0);
        const timeSinceLastProcess = Date.now() - session.lastProcessedTime;

        if (
          (totalSize >= BUFFER_SIZE_THRESHOLD || timeSinceLastProcess >= PROCESS_INTERVAL) &&
          !session.isProcessing &&
          session.audioBuffer.length > 0
        ) {
          await processAudioBuffer(sessionId);
        }
      } catch (error: any) {
        console.error('[Streaming Speech] Error processing message:', error);
        ws.send(JSON.stringify({ type: 'error', message: error.message }));
      }
    });

    // 处理连接关闭
    ws.on('close', () => {
      console.log(`[Streaming Speech] Connection closed: ${sessionId}`);
      // 处理剩余的音频数据
      if (session.audioBuffer.length > 0) {
        processAudioBuffer(sessionId).catch(console.error);
      }
      sessions.delete(sessionId);
    });

    // 处理错误
    ws.on('error', (error) => {
      console.error(`[Streaming Speech] WebSocket error for ${sessionId}:`, error);
      sessions.delete(sessionId);
    });
  });

  console.log('[Streaming Speech] WebSocket server initialized on /ws/speech-recognition');
  return wss;
}

/**
 * 处理音频缓冲区
 */
async function processAudioBuffer(sessionId: string) {
  const session = sessions.get(sessionId);
  if (!session || session.isProcessing || session.audioBuffer.length === 0) {
    return;
  }

  session.isProcessing = true;
  session.lastProcessedTime = Date.now();

  try {
    // 合并缓冲区中的所有音频数据
    const audioData = Buffer.concat(session.audioBuffer);
    session.audioBuffer = []; // 清空缓冲区

    // 调用语音识别API
    const text = await recognizeSpeechStream(audioData, session.language);

    if (text && text.trim()) {
      // 检测语言
      const detectedLang = detectLanguage(text);
      const confidence = getLanguageConfidence(text, detectedLang);
      const langName = getLanguageName(detectedLang);
      
      // 如果检测到的语言与当前语言不同，且置信度较高，则自动切换
      if (detectedLang !== session.language && confidence > 0.7) {
        console.log(`[Streaming Speech] Language switched from ${session.language} to ${detectedLang}`);
        session.language = detectedLang;
        session.ws.send(JSON.stringify({
          type: 'languageChanged',
          language: detectedLang,
          languageName: langName,
          confidence,
        }));
      }
      
      // 发送识别结果
      session.ws.send(JSON.stringify({
        type: 'transcript',
        text,
        isFinal: false,
        language: detectedLang,
        languageName: langName,
        languageConfidence: confidence,
      }));
    }
  } catch (error: any) {
    console.error('[Streaming Speech] Error processing audio buffer:', error);
    session.ws.send(JSON.stringify({
      type: 'error',
      message: `Recognition error: ${error.message}`,
    }));
  } finally {
    session.isProcessing = false;
  }
}

/**
 * 调用语音识别API（流式）
 */
async function recognizeSpeechStream(audioData: Buffer, language: string): Promise<string> {
  // 优先使用DeepSeek API
  if (process.env.DEEPSEEK_API_KEY) {
    return await recognizeWithDeepSeek(audioData, language);
  }

  // 备用：使用OpenAI Whisper
  if (process.env.OPENAI_API_KEY) {
    return await recognizeWithOpenAI(audioData, language);
  }

  throw new Error('No speech recognition API configured');
}

/**
 * 使用DeepSeek识别语音
 */
async function recognizeWithDeepSeek(audioData: Buffer, language: string): Promise<string> {
  try {
    const FormData = (await import('form-data')).default;
    const form = new FormData();
    
    // 将音频数据转换为文件
    form.append('file', audioData, {
      filename: 'audio.webm',
      contentType: 'audio/webm',
    });
    form.append('model', 'whisper-1');
    form.append('language', language === 'zh' ? 'zh' : 'en');

    const response = await axios.post(
      'https://api.deepseek.com/v1/audio/transcriptions',
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        },
        timeout: 30000,
      }
    );

    return response.data.text || '';
  } catch (error: any) {
    console.error('[Streaming Speech] DeepSeek recognition error:', error.message);
    throw error;
  }
}

/**
 * 使用OpenAI Whisper识别语音
 */
async function recognizeWithOpenAI(audioData: Buffer, language: string): Promise<string> {
  try {
    const FormData = (await import('form-data')).default;
    const form = new FormData();
    
    form.append('file', audioData, {
      filename: 'audio.webm',
      contentType: 'audio/webm',
    });
    form.append('model', 'whisper-1');
    form.append('language', language === 'zh' ? 'zh' : 'en');

    const response = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions',
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        timeout: 30000,
      }
    );

    return response.data.text || '';
  } catch (error: any) {
    console.error('[Streaming Speech] OpenAI recognition error:', error.message);
    throw error;
  }
}

/**
 * 生成会话ID
 */
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 获取活跃会话数
 */
export function getActiveSessionCount(): number {
  return sessions.size;
}

/**
 * 清理过期会话
 */
export function cleanupExpiredSessions(maxIdleTime: number = 300000) {
  const now = Date.now();
  for (const [sessionId, session] of Array.from(sessions.entries())) {
    if (now - session.lastProcessedTime > maxIdleTime) {
      console.log(`[Streaming Speech] Cleaning up expired session: ${sessionId}`);
      session.ws.close();
      sessions.delete(sessionId);
    }
  }
}

// 定期清理过期会话
setInterval(() => {
  cleanupExpiredSessions();
}, 60000); // 每分钟清理一次
