import { useState, useCallback } from 'react';
import type { ChatRequest, ChatResponse } from '../types/contracts';
import { sendMessage, ApiError } from '../api/client';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  response?: ChatResponse;
  isLoading?: boolean;
  error?: string;
}

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [activeResponse, setActiveResponse] = useState<ChatResponse | null>(null);
  const [language, setLanguage] = useState<'en' | 'hi' | 'mr'>('en');

  const send = useCallback(async (text: string, languageOverride?: 'en' | 'hi' | 'mr') => {
    const targetLanguage = languageOverride || language;
    if (languageOverride && languageOverride !== language) {
      setLanguage(languageOverride);
    }

    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    const loadingMsg: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true,
    };

    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setIsLoading(true);

    try {
      const req: ChatRequest = {
        conversation_id: conversationId ?? undefined,
        message: text,
        user_context: {
          language_preference: targetLanguage,
        },
      };

      // Always call the live backend API
      const response = await sendMessage(req);

      if (!conversationId && response.conversation_id) {
        setConversationId(response.conversation_id);
      }


      const assistantMsg: ChatMessage = {
        id: loadingMsg.id,
        role: 'assistant',
        content: response.answer,
        timestamp: new Date(),
        response,
      };

      setMessages(prev => prev.map(m => m.id === loadingMsg.id ? assistantMsg : m));
      setActiveResponse(response);
    } catch (err) {
      let errorMsg = 'Failed to connect to SAMUDRA backend.';
      if (err instanceof ApiError) {
        if (typeof err.body === 'object' && err.body !== null && 'detail' in err.body) {
          errorMsg = String((err.body as Record<string, unknown>).detail);
        } else if (typeof err.body === 'object' && err.body !== null && 'message' in err.body) {
          errorMsg = String((err.body as Record<string, unknown>).message);
        } else {
          errorMsg = `API Error (${err.status}): ${err.statusText}`;
        }
      } else if (err instanceof Error) {
        errorMsg = err.message;
      }

      setMessages(prev => prev.map(m =>
        m.id === loadingMsg.id
          ? { ...m, isLoading: false, error: errorMsg, content: errorMsg }
          : m
      ));
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, language]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setActiveResponse(null);
  }, []);

  return {
    messages,
    isLoading,
    conversationId,
    activeResponse,
    language,
    setLanguage,
    send,
    clearChat,
  };
}
