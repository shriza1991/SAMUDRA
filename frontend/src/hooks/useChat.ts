import { useState, useCallback } from 'react';
import type { ChatRequest, ChatResponse } from '../types/contracts';
import { sendMessage, ApiError } from '../api/client';
import { MOCK_SAFETY_RESPONSE, MOCK_PFZ_RESPONSE } from '../api/mock-data';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  response?: ChatResponse;
  isLoading?: boolean;
  error?: string;
}

const USE_MOCK = true; // Toggle to false when backend is available

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function getMockResponse(message: string): ChatResponse {
  const lower = message.toLowerCase();
  if (lower.includes('pfz') || lower.includes('fishing zone')) {
    return { ...MOCK_PFZ_RESPONSE, run_id: `run_${Date.now()}` };
  }
  return { ...MOCK_SAFETY_RESPONSE, run_id: `run_${Date.now()}` };
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [activeResponse, setActiveResponse] = useState<ChatResponse | null>(null);
  const [language, setLanguage] = useState<'en' | 'hi' | 'mr'>('en');

  const send = useCallback(async (text: string) => {
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
      let response: ChatResponse;

      if (USE_MOCK) {
        // Simulate network delay
        await new Promise(r => setTimeout(r, 800 + Math.random() * 700));
        response = getMockResponse(text);
      } else {
        const req: ChatRequest = {
          conversation_id: conversationId ?? undefined,
          message: text,
          user_context: {
            language_preference: language === 'en' ? 'auto' : language,
          },
        };
        response = await sendMessage(req);
      }

      if (!conversationId) {
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
      const errorMsg = err instanceof ApiError
        ? `Server error (${err.status}): ${err.statusText}`
        : 'Failed to connect to SAMUDRA backend. Please check if the server is running.';

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
