import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Loader, Volume2 } from 'lucide-react';

export interface VoiceCommandFeedbackProps {
  status: 'idle' | 'listening' | 'processing' | 'success' | 'error';
  message?: string;
  confidence?: number;
  commandName?: string;
  autoHideDuration?: number;
  onDismiss?: () => void;
}

export const VoiceCommandFeedback: React.FC<VoiceCommandFeedbackProps> = ({
  status,
  message,
  confidence,
  commandName,
  autoHideDuration = 3000,
  onDismiss,
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (status === 'success' || status === 'error') {
      const timer = setTimeout(() => {
        setIsVisible(false);
        onDismiss?.();
      }, autoHideDuration);

      return () => clearTimeout(timer);
    }
  }, [status, autoHideDuration, onDismiss]);

  if (!isVisible) return null;

  const getStatusConfig = () => {
    switch (status) {
      case 'listening':
        return {
          icon: <Volume2 className="w-5 h-5 animate-pulse" />,
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          textColor: 'text-blue-800',
          title: '监听中...',
        };
      case 'processing':
        return {
          icon: <Loader className="w-5 h-5 animate-spin" />,
          bgColor: 'bg-purple-50',
          borderColor: 'border-purple-200',
          textColor: 'text-purple-800',
          title: '处理中...',
        };
      case 'success':
        return {
          icon: <CheckCircle className="w-5 h-5 text-green-600" />,
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          textColor: 'text-green-800',
          title: '成功',
        };
      case 'error':
        return {
          icon: <AlertCircle className="w-5 h-5 text-red-600" />,
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          textColor: 'text-red-800',
          title: '失败',
        };
      default:
        return {
          icon: null,
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          textColor: 'text-gray-800',
          title: '',
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div
      className={`fixed bottom-4 right-4 p-4 rounded-lg border-2 ${config.bgColor} ${config.borderColor} ${config.textColor} shadow-lg max-w-sm z-50`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">{config.icon}</div>
        <div className="flex-1">
          <div className="font-semibold">{config.title}</div>
          {commandName && (
            <div className="text-sm mt-1">
              命令: <span className="font-mono">{commandName}</span>
            </div>
          )}
          {message && <div className="text-sm mt-1">{message}</div>}
          {confidence !== undefined && (
            <div className="text-sm mt-1">
              置信度: {(confidence * 100).toFixed(0)}%
            </div>
          )}
        </div>
        <button
          onClick={() => {
            setIsVisible(false);
            onDismiss?.();
          }}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default VoiceCommandFeedback;
