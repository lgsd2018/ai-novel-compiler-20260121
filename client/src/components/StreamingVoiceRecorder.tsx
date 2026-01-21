/**
 * Streaming Voice Recorder Component
 * 实时流式语音识别组件
 */

import { useEffect, useRef } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { useStreamingSpeechRecognition } from '@/hooks/useStreamingSpeechRecognition';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mic, MicOff, X, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';

interface StreamingVoiceRecorderProps {
  onTranscribe: (text: string) => void;
  onClose: () => void;
  language?: string;
}

export function StreamingVoiceRecorder({ 
  onTranscribe, 
  onClose,
  language = 'zh' 
}: StreamingVoiceRecorderProps) {
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const {
    isConnected,
    isRecording,
    transcript,
    error,
    connect,
    disconnect,
    startRecording,
    stopRecording,
    clearTranscript,
  } = useStreamingSpeechRecognition({
    userId: user?.id || 0,
    language,
    onTranscript: (text) => {
      // 实时更新转录文本
      console.log('[Streaming Voice] New transcript:', text);
    },
    onError: (err) => {
      toast.error(`识别错误: ${err.message}`);
    },
    onConnectionChange: (connected) => {
      if (connected) {
        toast.success('已连接到语音识别服务');
      } else {
        toast.info('已断开语音识别服务');
      }
    },
  });

  /**
   * 绘制波形
   */
  const drawWaveform = () => {
    if (!canvasRef.current || !analyserRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);

      analyser.getByteTimeDomainData(dataArray);

      ctx.fillStyle = 'rgb(20, 20, 30)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgb(59, 130, 246)';
      ctx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    };

    draw();
  };

  /**
   * 开始录音并绘制波形
   */
  const handleStartRecording = async () => {
    try {
      // 获取音频流用于波形显示
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      drawWaveform();

      // 开始实时识别
      await startRecording();
    } catch (error: any) {
      toast.error(`无法访问麦克风: ${error.message}`);
    }
  };

  /**
   * 停止录音
   */
  const handleStopRecording = () => {
    stopRecording();

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  /**
   * 插入转录文本
   */
  const handleInsertText = () => {
    if (transcript.trim()) {
      onTranscribe(transcript);
      clearTranscript();
      toast.success('文本已插入');
    }
  };

  /**
   * 组件挂载时连接
   */
  useEffect(() => {
    connect();
    return () => {
      disconnect();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [connect, disconnect]);

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mic className="w-5 h-5" />
              实时语音识别
            </CardTitle>
            <CardDescription>
              边说边转写，实时显示识别结果
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-sm">
              {isConnected ? (
                <>
                  <Wifi className="w-4 h-4 text-green-500" />
                  <span className="text-green-500">已连接</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-400">未连接</span>
                </>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 波形显示 */}
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={600}
            height={100}
            className="w-full rounded-md border border-border"
          />
          {!isRecording && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-md">
              <p className="text-sm text-muted-foreground">点击开始录音</p>
            </div>
          )}
        </div>

        {/* 控制按钮 */}
        <div className="flex gap-2">
          {!isRecording ? (
            <Button
              onClick={handleStartRecording}
              disabled={!isConnected}
              className="flex-1"
            >
              <Mic className="w-4 h-4 mr-2" />
              开始录音
            </Button>
          ) : (
            <Button
              onClick={handleStopRecording}
              variant="destructive"
              className="flex-1"
            >
              <MicOff className="w-4 h-4 mr-2" />
              停止录音
            </Button>
          )}
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
            {error}
          </div>
        )}

        {/* 转录结果 */}
        {transcript && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">识别结果</label>
              <Button
                variant="outline"
                size="sm"
                onClick={clearTranscript}
              >
                清空
              </Button>
            </div>
            <div className="p-3 bg-muted rounded-md min-h-[100px] max-h-[200px] overflow-y-auto whitespace-pre-wrap text-sm">
              {transcript}
              {isRecording && <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1" />}
            </div>
            <Button
              onClick={handleInsertText}
              disabled={!transcript.trim()}
              className="w-full"
            >
              插入到编辑器
            </Button>
          </div>
        )}

        {/* 使用提示 */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>💡 提示：</p>
          <ul className="list-disc list-inside space-y-1">
            <li>点击"开始录音"后即可开始说话</li>
            <li>识别结果会实时显示在下方</li>
            <li>支持长时间连续识别</li>
            <li>点击"插入到编辑器"将文本添加到当前位置</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
