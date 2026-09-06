import { useRef, useEffect } from 'react';
import type { ChatMessage as ChatMessageType } from '../../hooks/useChat';
import type { ChatResponse } from '../../types/contracts';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import SamplePrompts from './SamplePrompts';
import RecommendationBanner from '../recommendation/RecommendationBanner';
import { Anchor } from 'lucide-react';

interface ChatPanelProps {
  messages: ChatMessageType[];
  activeResponse: ChatResponse | null;
  isLoading: boolean;
  onSend: (text: string) => void;
  onEvidenceClick?: () => void;
}

export default function ChatPanel({
  messages,
  activeResponse,
  isLoading,
  onSend,
  onEvidenceClick,
}: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
            <h2 className="chat-welcome-title">SAMUDRA Marine Assistant</h2>
            <p className="chat-welcome-subtitle">
              Ask about fishing zones, departure safety, hazards, or route comparisons
              along the Maharashtra coast.
            </p>
            <SamplePrompts onSelect={onSend} disabled={isLoading} />
          </div>
        )}

        {messages.map(msg => (
          <ChatMessage key={msg.id} message={msg} onEvidenceClick={onEvidenceClick} />
        ))}

        {/* Show recommendation banner after the latest assistant response */}
        {activeResponse && !isLoading && activeResponse.recommendation && (
          <div className="chat-recommendation-wrapper">
            <RecommendationBanner
              recommendation={activeResponse.recommendation}
              confidence={activeResponse.confidence}
            />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <ChatInput onSend={onSend} disabled={isLoading} />
    </section>
  );
}
