
import type { ChatMessage as ChatMessageType } from '../../hooks/useChat';
import { AlertTriangle, Bot, User } from 'lucide-react';

interface ChatMessageProps {
  message: ChatMessageType;
  onEvidenceClick?: () => void;
}

export default function ChatMessage({ message, onEvidenceClick }: ChatMessageProps) {
  const isUser = message.role === 'user';

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
          <span className="chat-loading-text">Agents reasoning...</span>
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
          <p className="chat-error-text">{message.error}</p>
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
        <p>{message.content}</p>
        {!isUser && message.response && message.response.evidence.length > 0 && (
          <button className="evidence-link" onClick={onEvidenceClick}>
            📋 View {message.response.evidence.length} evidence source{message.response.evidence.length > 1 ? 's' : ''}
          </button>
        )}
        {!isUser && message.response?.suggested_followups && message.response.suggested_followups.length > 0 && (
          <div className="suggested-followups">
            {message.response.suggested_followups.map((followup, i) => (
              <span key={i} className="followup-chip">{followup}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
