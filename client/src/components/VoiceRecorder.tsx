import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Mic, Square, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface VoiceRecorderProps {
  onTranscribe: (text: string) => void;
  onClose: () => void;
}

export function VoiceRecorder({ onTranscribe, onClose }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [language, setLanguage] = useState("zh-CN");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const { data: languages } = trpc.stt.getSupportedLanguages.useQuery(undefined);
  const transcribeMutation = trpc.stt.transcribe.useMutation({
    onSuccess: (data) => {
      onTranscribe(data.text);
      toast.success("识别成功");
      setAudioBlob(null);
    },
    onError: (error) => {
      toast.error(`识别失败: ${error.message}`);
    },
  });

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });

      // Setup audio visualization
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
        if (audioContextRef.current) {
          audioContextRef.current.close();
        }
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      visualize();
      toast.info("开始录音");
    } catch (error) {
      toast.error("无法访问麦克风");
      console.error(error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (animationFrameRef.current !== undefined) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      toast.info("录音已停止");
    }
  };

  const visualize = () => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const canvasCtx = canvas.getContext("2d");
    if (!canvasCtx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);

      analyser.getByteFrequencyData(dataArray);

      canvasCtx.fillStyle = "rgb(15, 23, 42)";
      canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * canvas.height;

        canvasCtx.fillStyle = `rgb(${barHeight + 100}, 100, 200)`;
        canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }
    };

    draw();
  };

  const handleTranscribe = async () => {
    if (!audioBlob) {
      toast.error("请先录音");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Audio = (reader.result as string).split(",")[1];
      transcribeMutation.mutate({
        audioData: base64Audio,
        language,
      });
    };
    reader.readAsDataURL(audioBlob);
  };

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== undefined) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">语音输入</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Waveform Visualization */}
      <canvas
        ref={canvasRef}
        width={400}
        height={100}
        className="w-full rounded-md bg-slate-900"
      />

      {/* Language Selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium">识别语言</label>
        <Select value={language} onValueChange={setLanguage}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {languages?.map((lang) => (
              <SelectItem key={lang} value={lang}>
                {lang}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Recording Controls */}
      <div className="flex gap-2">
        {!isRecording ? (
          <Button onClick={startRecording} className="flex-1" disabled={!!audioBlob}>
            <Mic className="w-4 h-4 mr-2" />
            开始录音
          </Button>
        ) : (
          <Button onClick={stopRecording} variant="destructive" className="flex-1">
            <Square className="w-4 h-4 mr-2" />
            停止录音
          </Button>
        )}
      </div>

      {/* Transcribe Button */}
      {audioBlob && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            录音完成，点击识别按钮将语音转换为文字
          </p>
          <Button
            onClick={handleTranscribe}
            className="w-full"
            disabled={transcribeMutation.isPending}
          >
            {transcribeMutation.isPending ? "识别中..." : "识别并插入"}
          </Button>
        </div>
      )}
    </Card>
  );
}
