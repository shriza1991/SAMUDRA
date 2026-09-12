import type React from 'react';
import { useState, useRef, useEffect } from 'react';
import { Send, Mic, Square, Loader2, X, PhoneCall } from 'lucide-react';
import { TRANSLATIONS, type SupportedLanguage } from '../../i18n/translations';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  language?: SupportedLanguage;
  onSend: (message: string, languageOverride?: 'en' | 'hi' | 'mr') => void;
  onStartCall?: () => void;
  disabled?: boolean;
  className?: string;
}

export default function ChatInput({ language = 'en', onSend, onStartCall, disabled, className }: ChatInputProps) {
  const [text, setText] = useState('');
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;

  const {
    isRecording,
    isTranscribing,
    error: voiceError,
    startRecording,
    stopRecording,
    clearError: clearVoiceError,
    isSupported,
  } = useVoiceRecorder({
    onTranscription: result => {
      if (result && result.transcript) {
        setDetectedLanguage(result.normalized_language);
        onSend(result.transcript, result.normalized_language as 'en' | 'hi' | 'mr');
      }
    },
  });

  useEffect(() => {
    if (!disabled && !isRecording && !isTranscribing) {
      inputRef.current?.focus();
    }
  }, [disabled, isRecording, isTranscribing]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled || isRecording || isTranscribing) return;
    onSend(trimmed);
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleMicClick = async () => {
    if (isRecording) {
      stopRecording();
    } else {
      await startRecording();
    }
  };

  return (
    <div className={cn('chat-input-container border-t border-border bg-card/60 p-3 backdrop-blur-xs', className)}>
      <div className="chat-input-wrapper relative flex flex-col gap-1.5">
        {voiceError && (
          <div className="voice-error-pill flex items-center justify-between rounded-md bg-destructive/15 px-2.5 py-1 text-xs text-destructive" role="alert">
            <span>{voiceError}</span>
            <button
              type="button"
              className="voice-error-close p-0.5 hover:opacity-80"
              onClick={clearVoiceError}
              aria-label="Dismiss error"
            >
              <X size={13} />
            </button>
          </div>
        )}

        {isRecording && (
          <div className="voice-status-pill recording flex items-center gap-2 rounded-md bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive" role="status" aria-live="polite">
            <span className="voice-pulse-dot size-2 rounded-full bg-destructive animate-pulse" />
            <span>{t.recordingIndicator}</span>
            <div className="voice-waveform-mini flex items-center gap-0.5" aria-hidden="true">
              <span className="waveform-bar bar-1 h-3 w-0.5 bg-destructive rounded-full" />
              <span className="waveform-bar bar-2 h-4 w-0.5 bg-destructive rounded-full" />
              <span className="waveform-bar bar-3 h-2 w-0.5 bg-destructive rounded-full" />
            </div>
          </div>
        )}

        {isTranscribing && (
          <div className="voice-status-pill transcribing flex items-center gap-2 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary" role="status" aria-live="polite">
            <Loader2 size={13} className="spin animate-spin" />
            <span>{t.transcribingIndicator}</span>
          </div>
        )}

        {detectedLanguage && !isRecording && !isTranscribing && (
          <Badge variant="outline" className="voice-status-pill detected w-fit gap-1 text-[11px]">
            <Mic size={12} />
            <span>Voice detected: {languageLabel(detectedLanguage)}</span>
          </Badge>
        )}

        <Textarea
          ref={inputRef}
          className="chat-input min-h-[42px] max-h-32 resize-none rounded-lg border-border bg-background/80 text-sm leading-relaxed"
          placeholder={isRecording ? t.recordingIndicator : t.inputPlaceholder}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || isRecording || isTranscribing}
          rows={1}
          aria-label={t.sendBtnAria}
        />
      </div>

      <div className="chat-input-actions mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {onStartCall && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="call-samudra-trigger-btn h-8 gap-1.5 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
              onClick={onStartCall}
              disabled={disabled || isRecording || isTranscribing}
              title={t.callSamudraBtn}
              aria-label={t.callSamudraBtn}
            >
              <span className="call-trigger-pulse-dot size-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
              <PhoneCall size={13} />
              <span className="text-xs font-semibold">{t.callSamudraBtn}</span>
            </Button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant={isRecording ? 'destructive' : 'ghost'}
            size="sm"
            className={cn('chat-mic-btn size-8 p-0', isRecording && 'animate-pulse')}
            onClick={handleMicClick}
            disabled={disabled || isTranscribing || !isSupported}
            title={
              !isSupported
                ? 'Voice recording not supported in this browser'
                : isRecording
                ? t.micRecordingAria
                : isTranscribing
                ? t.micTranscribingAria
                : t.micBtnAria
            }
            aria-label={
              !isSupported
                ? 'Voice recording not supported in this browser'
                : isRecording
                ? t.micRecordingAria
                : isTranscribing
                ? t.micTranscribingAria
                : t.micBtnAria
            }
          >
            {isTranscribing ? (
              <Loader2 size={16} className="spin animate-spin" />
            ) : isRecording ? (
              <Square size={14} fill="currentColor" />
            ) : (
              <Mic size={16} />
            )}
          </Button>

          <Button
            type="button"
            variant="default"
            size="sm"
            className="chat-send-btn size-8 p-0 shadow-xs"
            onClick={handleSend}
            disabled={disabled || isRecording || isTranscribing || !text.trim()}
            aria-label={t.sendBtnAria}
          >
            <Send size={15} />
          </Button>
        </div>
      </div>
    </div>
  );
}

function languageLabel(language: string): string {
  const normalized = language.toLowerCase();
  if (normalized.startsWith('hi')) return 'Hindi';
  if (normalized.startsWith('mr')) return 'Marathi';
  if (normalized.startsWith('ta')) return 'Tamil';
  return 'English';
}
