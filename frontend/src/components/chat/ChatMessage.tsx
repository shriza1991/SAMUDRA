import type { ChatMessage as ChatMessageType } from '../../hooks/useChat';
import { AlertTriangle, Bot, User } from 'lucide-react';
import { TRANSLATIONS, translateChatMessage, translateText, type SupportedLanguage } from '../../i18n/translations';

interface ChatMessageProps {
  message: ChatMessageType;
  language?: SupportedLanguage;
  onEvidenceClick?: () => void;
  onFollowUp?: (message: string) => void;
}

export default function ChatMessage({ message, language = 'en', onEvidenceClick, onFollowUp }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const displayContent = translateChatMessage(message.content, language, message.response?.intent);

  if (message.isLoading) {
    return (
      <div className="chat-message assistant">
        <div className="chat-message-avatar">
          <Bot size={16} />
        </div>
        <div className="chat-message-content">
          <div className="chat-loading">
            <span className="chat-loading-dot" />
            <span className="chat-loading-dot" />
            <span className="chat-loading-dot" />
          </div>
          <span className="chat-loading-text">{t.agentsReasoning}</span>
        </div>
      </div>
    );
  }

  if (message.error) {
    return (
      <div className="chat-message assistant error">
        <div className="chat-message-avatar error-avatar">
          <AlertTriangle size={16} />
        </div>
        <div className="chat-message-content">
          <p className="chat-error-text">{translateText(message.error, language)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`chat-message ${isUser ? 'user' : 'assistant'}`}>
      <div className={`chat-message-avatar ${isUser ? 'user-avatar' : ''}`}>
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>
      <div className="chat-message-content">
        <p style={{ whiteSpace: 'pre-line' }}>{displayContent}</p>
        {!isUser && message.response && message.response.evidence.length > 0 && (
          <button className="evidence-link" onClick={onEvidenceClick}>
            {t.viewEvidenceBtn(message.response.evidence.length)}
          </button>
        )}
        {!isUser && message.response?.suggested_followups && message.response.suggested_followups.length > 0 && (
          <div className="suggested-followups">
            {message.response.suggested_followups.map((followup, i) => (
              <button
                key={i}
                type="button"
                className="followup-chip"
                onClick={() => onFollowUp?.(followup)}
                disabled={!onFollowUp}
              >
                {translateText(followup, language)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
