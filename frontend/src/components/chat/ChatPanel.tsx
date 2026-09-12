import { useRef, useEffect } from 'react';
import type { ChatMessage as ChatMessageType } from '../../hooks/useChat';
import type { ChatResponse } from '../../types/contracts';
import { TRANSLATIONS, type SupportedLanguage } from '../../i18n/translations';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import SamplePrompts from './SamplePrompts';
import RecommendationBanner from '../recommendation/RecommendationBanner';
import { Button } from '@/components/ui/button';
import { Anchor, ArrowLeft, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatPanelProps {
  language: SupportedLanguage;
  messages: ChatMessageType[];
  activeResponse: ChatResponse | null;
  isLoading: boolean;
  onSend: (text: string, languageOverride?: 'en' | 'hi' | 'mr') => void;
  onStartCall?: () => void;
  onBack?: () => void;
  onReset?: () => void;
  onEvidenceClick?: () => void;
  className?: string;
}

export default function ChatPanel({
  language,
  messages,
  activeResponse,
  isLoading,
  onSend,
  onStartCall,
  onBack,
  onReset,
  onEvidenceClick,
  className,
}: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeResponse, isLoading]);

  const showWelcome = messages.length === 0;

  return (
    <section className={cn('chat-panel flex h-full flex-col bg-background', className)} aria-label="Chat interface">
      <div className="chat-panel-topbar flex items-center justify-between border-b border-border/80 bg-card/40 px-3 py-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="chat-back-btn h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={onBack}
          title={t.backToStart}
          aria-label={t.backToStart}
        >
          <ArrowLeft size={14} />
          <span>{t.back}</span>
        </Button>

        <span className="chat-panel-title text-xs font-semibold tracking-wide text-foreground">
          {t.chatTitle}
        </span>

        <div className="flex items-center gap-1.5">
          {messages.length > 0 && onReset && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="chat-reset-btn h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={onReset}
              title={t.newChat}
              aria-label={t.newChat}
            >
              <RotateCcw size={13} />
              <span className="hidden sm:inline">{t.newChat}</span>
            </Button>
          )}
        </div>
      </div>

      <div className="chat-messages flex-1 overflow-y-auto p-4 space-y-3" role="log" aria-live="polite">
        {showWelcome && (
          <div className="chat-welcome my-auto flex flex-col items-center justify-center text-center py-6">
            <div className="chat-welcome-icon mb-3 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-xs">
              <Anchor size={24} />
            </div>
            <h2 className="chat-welcome-title text-base font-bold text-foreground sm:text-lg">{t.welcomeTitle}</h2>
            <p className="chat-welcome-subtitle mt-1 max-w-sm text-xs text-muted-foreground leading-relaxed">{t.welcomeSubtitle}</p>
            <SamplePrompts language={language} onSelect={onSend} disabled={isLoading} />
          </div>
        )}

        {messages.map(msg => (
          <ChatMessage
            key={msg.id}
            message={msg}
            language={language}
            onEvidenceClick={onEvidenceClick}
            onFollowUp={onSend}
          />
        ))}

        {/* Show recommendation banner after the latest assistant response */}
        {activeResponse && !isLoading && activeResponse.recommendation && (
          <div className="chat-recommendation-wrapper pt-2">
            <RecommendationBanner
              recommendation={activeResponse.recommendation}
              confidence={activeResponse.confidence}
              warnings={activeResponse.warnings}
              language={language}
            />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <ChatInput language={language} onSend={onSend} onStartCall={onStartCall} disabled={isLoading} />
    </section>
  );
}
