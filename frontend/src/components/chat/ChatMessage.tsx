import { useState, useEffect } from 'react';
import type { ChatMessage as ChatMessageType } from '../../hooks/useChat';
import { AlertTriangle, Bot, User, Volume2, VolumeX } from 'lucide-react';
import { TRANSLATIONS, translateChatMessage, translateText, type SupportedLanguage } from '../../i18n/translations';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ChatMessageProps {
  message: ChatMessageType;
  language?: SupportedLanguage;
  onEvidenceClick?: () => void;
  onFollowUp?: (message: string) => void;
  className?: string;
}

export default function ChatMessage({ message, language = 'en', onEvidenceClick, onFollowUp, className }: ChatMessageProps) {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const isUser = message.role === 'user';
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const displayContent = translateChatMessage(message.content, language, message.response?.intent);

  useEffect(() => {
    return () => {
      if (isPlayingAudio && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isPlayingAudio]);

  const handleToggleSpeak = () => {
    if (isPlayingAudio) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsPlayingAudio(false);
      return;
    }

    const voiceAudio = (message.response as any)?.audio_base64;
    if (voiceAudio) {
      try {
        const audio = new Audio(`data:audio/mp3;base64,${voiceAudio}`);
        audio.onended = () => setIsPlayingAudio(false);
        audio.onerror = () => setIsPlayingAudio(false);
        audio.play().catch(() => setIsPlayingAudio(false));
        setIsPlayingAudio(true);
        return;
      } catch {
        // Fallback to speechSynthesis
      }
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(displayContent);
      utterance.lang = language === 'hi' ? 'hi-IN' : language === 'mr' ? 'mr-IN' : 'en-IN';
      utterance.rate = 0.95;
      utterance.onend = () => setIsPlayingAudio(false);
      utterance.onerror = () => setIsPlayingAudio(false);
      setIsPlayingAudio(true);
      window.speechSynthesis.speak(utterance);
    }
  };

  if (message.isLoading) {
    return (
      <div className={cn('chat-message assistant flex items-start gap-3 py-2 text-sm', className)}>
        <div className="chat-message-avatar flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Bot size={15} />
        </div>
        <div className="chat-message-content flex-1 space-y-1">
          <div className="chat-loading flex items-center gap-1.5 py-1">
            <span className="chat-loading-dot size-1.5 rounded-full bg-primary animate-pulse" />
            <span className="chat-loading-dot size-1.5 rounded-full bg-primary animate-pulse delay-150" />
            <span className="chat-loading-dot size-1.5 rounded-full bg-primary animate-pulse delay-300" />
            <span className="chat-loading-text ml-2 text-xs text-muted-foreground">{t.agentsReasoning}</span>
          </div>
        </div>
      </div>
    );
  }

  if (message.error) {
    return (
      <div className={cn('chat-message assistant error flex items-start gap-3 py-2 text-sm', className)}>
        <div className="chat-message-avatar error-avatar flex size-7 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive">
          <AlertTriangle size={15} />
        </div>
        <div className="chat-message-content flex-1 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
          <p className="chat-error-text text-xs text-destructive">{translateText(message.error, language)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('chat-message flex items-start gap-3 py-2 text-sm', isUser ? 'user flex-row-reverse' : 'assistant', className)}>
      <div
        className={cn(
          'chat-message-avatar flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
          isUser ? 'user-avatar bg-primary text-primary-foreground' : 'bg-primary/15 text-primary'
        )}
      >
        {isUser ? <User size={15} /> : <Bot size={15} />}
      </div>
      <div
        className={cn(
          'chat-message-content max-w-[85%] rounded-xl px-3.5 py-2.5 shadow-xs leading-relaxed',
          isUser
            ? 'bg-primary text-primary-foreground rounded-tr-xs'
            : 'bg-card border border-border/80 text-card-foreground rounded-tl-xs'
        )}
      >
        <p style={{ whiteSpace: 'pre-line' }}>{displayContent}</p>
        {!isUser && (
          <div className="message-action-row mt-2 flex flex-wrap items-center gap-2 border-t border-border/40 pt-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn('message-tts-btn h-6 gap-1 px-2 text-[11px] font-medium', isPlayingAudio && 'text-primary animate-pulse')}
              onClick={handleToggleSpeak}
              title={isPlayingAudio ? t.stopAudioBtn : t.listenBtn}
              aria-label={isPlayingAudio ? t.stopAudioBtn : t.listenBtn}
            >
              {isPlayingAudio ? <VolumeX size={12} /> : <Volume2 size={12} />}
              <span>{isPlayingAudio ? t.stopAudioBtn : t.listenBtn}</span>
            </Button>
            {message.response && message.response.evidence.length > 0 && (
              <Button
                type="button"
                variant="link"
                size="sm"
                className="evidence-link h-6 p-0 text-[11px] text-primary underline-offset-4"
                onClick={onEvidenceClick}
              >
                {t.viewEvidenceBtn(message.response.evidence.length)}
              </Button>
            )}
          </div>
        )}
        {!isUser && message.response?.suggested_followups && message.response.suggested_followups.length > 0 && (
          <div className="suggested-followups mt-2.5 flex flex-wrap gap-1.5 pt-1">
            {message.response.suggested_followups.map((followup, i) => (
              <Button
                key={i}
                type="button"
                variant="outline"
                size="sm"
                className="followup-chip h-auto py-1 px-2.5 text-xs text-left rounded-full whitespace-normal border-border/80 bg-background/50 hover:bg-muted"
                onClick={() => onFollowUp?.(followup)}
                disabled={!onFollowUp}
              >
                {translateText(followup, language)}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
