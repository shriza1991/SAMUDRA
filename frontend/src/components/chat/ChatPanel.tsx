import { useRef, useEffect } from 'react';
import type { ChatMessage as ChatMessageType } from '../../hooks/useChat';
import type { ChatResponse } from '../../types/contracts';
import { TRANSLATIONS, type SupportedLanguage } from '../../i18n/translations';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import SamplePrompts from './SamplePrompts';
import RecommendationBanner from '../recommendation/RecommendationBanner';
import { Anchor } from 'lucide-react';

interface ChatPanelProps {
  language: SupportedLanguage;
  messages: ChatMessageType[];
  activeResponse: ChatResponse | null;
  isLoading: boolean;
  onSend: (text: string) => void;
  onEvidenceClick?: () => void;
}

export default function ChatPanel({
  language,
  messages,
  activeResponse,
  isLoading,
  onSend,
  onEvidenceClick,
}: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const showWelcome = messages.length === 0;

  return (
    <section className="chat-panel" aria-label="Chat interface">
      <div className="chat-messages" role="log" aria-live="polite">
        {showWelcome && (
          <div className="chat-welcome">
            <div className="chat-welcome-icon">
              <Anchor size={32} />
            </div>
            <h2 className="chat-welcome-title">{t.welcomeTitle}</h2>
            <p className="chat-welcome-subtitle">{t.welcomeSubtitle}</p>
            <SamplePrompts language={language} onSelect={onSend} disabled={isLoading} />
          </div>
        )}

        {messages.map(msg => (
          <ChatMessage
            key={msg.id}
            message={msg}
            language={language}
            onEvidenceClick={onEvidenceClick}
          />
        ))}

        {/* Show recommendation banner after the latest assistant response */}
        {activeResponse && !isLoading && activeResponse.recommendation && (
          <div className="chat-recommendation-wrapper">
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

      <ChatInput language={language} onSend={onSend} disabled={isLoading} />
    </section>
  );
}
