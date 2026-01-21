/**
 * Streaming Speech Recognition Hook
 * 实时流式语音识别Hook
 */

import { useState, useRef, useCallback, useEffect } from 'react';

interface UseStreamingSpeechRecognitionOptions {
  userId: number;
  language?: string;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onError?: (error: Error) => void;
  onConnectionChange?: (connected: boolean) => void;
}

interface StreamingSpeechRecognitionState {
  isConnected: boolean;
  isRecording: boolean;
  transcript: string;
  error: string | null;
}

export function useStreamingSpeechRecognition(options: UseStreamingSpeechRecognitionOptions) {
  const { userId, language = 'zh', onTranscript, onError, onConnectionChange } = options;

  const [state, setState] = useState<StreamingSpeechRecognitionState>({
    isConnected: false,
    isRecording: false,
    transcript: '',
    error: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  /**
   * 连接WebSocket
   */
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      // 构建WebSocket URL
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws/speech-recognition?userId=${userId}&language=${language}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[Streaming Speech] WebSocket connected');
        setState(prev => ({ ...prev, isConnected: true, error: null }));
        reconnectAttemptsRef.current = 0;
        onConnectionChange?.(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case 'connected':
              console.log('[Streaming Speech] Session established:', data.sessionId);
              break;

            case 'transcript':
              setState(prev => ({
                ...prev,
                transcript: prev.transcript + data.text,
              }));
              onTranscript?.(data.text, data.isFinal || false);
              break;

            case 'languageChanged':
              console.log(`[Streaming Speech] Language changed to ${data.language}`);
              // 可以通过回调通知用户
              break;

            case 'error':
              console.error('[Streaming Speech] Server error:', data.message);
              setState(prev => ({ ...prev, error: data.message }));
              onError?.(new Error(data.message));
              break;

            default:
              console.warn('[Streaming Speech] Unknown message type:', data.type);
          }
        } catch (error) {
          console.error('[Streaming Speech] Error parsing message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('[Streaming Speech] WebSocket error:', error);
        setState(prev => ({ ...prev, error: 'WebSocket connection error' }));
        onError?.(new Error('WebSocket connection error'));
      };

      ws.onclose = () => {
        console.log('[Streaming Speech] WebSocket closed');
        setState(prev => ({ ...prev, isConnected: false }));
        onConnectionChange?.(false);

        // 自动重连（最多尝试5次）
        if (reconnectAttemptsRef.current < 5) {
          reconnectAttemptsRef.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          console.log(`[Streaming Speech] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };
    } catch (error: any) {
      console.error('[Streaming Speech] Error creating WebSocket:', error);
      setState(prev => ({ ...prev, error: error.message }));
      onError?.(error);
    }
  }, [userId, language, onTranscript, onError, onConnectionChange]);

  /**
   * 断开WebSocket
   */
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setState(prev => ({ ...prev, isConnected: false }));
  }, []);

  /**
   * 开始录音
   */
  const startRecording = useCallback(async () => {
    try {
      // 连接WebSocket
      if (!state.isConnected) {
        connect();
        // 等待连接建立
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // 获取麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      // 创建MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });
      mediaRecorderRef.current = mediaRecorder;

      // 处理音频数据
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
          // 发送音频数据到服务器
          wsRef.current.send(event.data);
        }
      };

      // 开始录音（每500ms发送一次数据）
      mediaRecorder.start(500);

      setState(prev => ({ ...prev, isRecording: true, error: null }));
    } catch (error: any) {
      console.error('[Streaming Speech] Error starting recording:', error);
      setState(prev => ({ ...prev, error: error.message }));
      onError?.(error);
    }
  }, [state.isConnected, connect, onError]);

  /**
   * 停止录音
   */
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }

    setState(prev => ({ ...prev, isRecording: false }));
  }, []);

  /**
   * 清空转录文本
   */
  const clearTranscript = useCallback(() => {
    setState(prev => ({ ...prev, transcript: '' }));
  }, []);

  /**
   * 组件卸载时清理
   */
  useEffect(() => {
    return () => {
      stopRecording();
      disconnect();
    };
  }, [stopRecording, disconnect]);

  return {
    ...state,
    connect,
    disconnect,
    startRecording,
    stopRecording,
    clearTranscript,
  };
}
