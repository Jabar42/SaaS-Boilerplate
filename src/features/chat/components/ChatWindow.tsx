'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, isTextUIPart } from 'ai';
import { useParams } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { ChatInput } from './ChatInput';
import { MessageBubble } from './MessageBubble';

type ChatWindowProps = {
  apiEndpoint?: string;
};

export function ChatWindow({ apiEndpoint }: ChatWindowProps) {
  const params = useParams();
  const locale = params?.locale as string | undefined;
  const finalApiEndpoint = apiEndpoint || `/${locale || 'en'}/api/chat`;
  const chatHelpers = useChat({
    transport: new DefaultChatTransport({
      api: finalApiEndpoint,
    }),
  });
  const { messages, error, status } = chatHelpers;
  const isLoading = status === 'submitted' || status === 'streaming';
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex h-full flex-col">
      {/* Messages Container */}
      <div className="min-h-0 flex-1 overflow-y-auto pb-32">
        {error && (
          <div className="mb-4 rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
            <strong>Error:</strong>
            {' '}
            {error.message}
          </div>
        )}

        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-center text-muted-foreground">
            <div>
              <p className="text-lg font-medium">Start a conversation</p>
              <p className="mt-2 text-sm">
                Send a message to begin chatting with the AI assistant.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {messages
            .filter(message => message.role !== 'system')
            .map((message) => {
              // Extract text from UIMessage parts
              const textParts = message.parts.filter(isTextUIPart);
              const content = textParts.map(part => part.text).join('');

              // Convert UIMessage to ChatMessage format
              const chatMessage = {
                id: message.id,
                role: message.role as 'user' | 'assistant',
                content,
                parts: textParts.map(part => ({
                  type: 'text' as const,
                  text: part.text,
                })),
              };
              return (
                <MessageBubble key={message.id} message={chatMessage} />
              );
            })}
        </div>
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput
        onSend={text => chatHelpers.sendMessage({ text })}
        disabled={isLoading}
        placeholder={isLoading ? 'AI is thinking...' : 'Say something...'}
      />
    </div>
  );
}
