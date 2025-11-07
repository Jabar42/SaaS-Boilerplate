'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, isTextUIPart } from 'ai';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useFiles } from '@/features/documents/hooks/useFiles';

import { useSelectedDocuments } from '../hooks/useSelectedDocuments';
import { ChatInput } from './ChatInput';
import { DocumentSelector } from './DocumentSelector';
import { MessageBubble } from './MessageBubble';

type ChatWindowProps = {
  apiEndpoint?: string;
};

export function ChatWindow({ apiEndpoint }: ChatWindowProps) {
  const params = useParams();
  const locale = params?.locale as string | undefined;
  const finalApiEndpoint = apiEndpoint || `/${locale || 'en'}/api/chat`;
  const [isDocumentSelectorOpen, setIsDocumentSelectorOpen] = useState(false);
  const {
    selectedDocuments,
    toggleDocument,
    setSelectedDocuments,
  } = useSelectedDocuments();
  const { userFiles } = useFiles();

  // Filtrar documentos seleccionados para incluir solo los que realmente existen
  const availableFilePaths = useMemo(
    () => new Set(userFiles.map(file => file.path)),
    [userFiles],
  );

  const validSelectedDocuments = useMemo(
    () => selectedDocuments.filter(path => availableFilePaths.has(path)),
    [selectedDocuments, availableFilePaths],
  );

  // Limpiar automáticamente documentos inválidos del estado y localStorage
  useEffect(() => {
    // Solo limpiar si hay documentos inválidos (cuando selectedDocuments tiene más que validSelectedDocuments)
    // Esto ocurre cuando hay documentos en localStorage que ya no existen en la lista de archivos
    if (selectedDocuments.length > validSelectedDocuments.length) {
      // Hay documentos inválidos, limpiarlos del estado (esto también actualizará localStorage)
      setSelectedDocuments(validSelectedDocuments);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableFilePaths.size, selectedDocuments.length, validSelectedDocuments.length]);

  // Usar ref para mantener los documentos actuales en el body
  const documentsRef = useRef<string[]>(validSelectedDocuments);
  useEffect(() => {
    documentsRef.current = validSelectedDocuments;
  }, [validSelectedDocuments]);

  const chatHelpers = useChat({
    transport: new DefaultChatTransport({
      api: finalApiEndpoint,
      body: () => ({
        documents: documentsRef.current,
      }),
    }),
  });

  const { messages, error, status } = chatHelpers;
  const isLoading = status === 'submitted' || status === 'streaming';
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (text: string) => {
    chatHelpers.sendMessage({
      text,
    });
  };

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
        onSend={handleSend}
        disabled={isLoading}
        placeholder={isLoading ? 'AI is thinking...' : 'Say something...'}
        onDocumentClick={() => setIsDocumentSelectorOpen(true)}
        selectedDocumentsCount={validSelectedDocuments.length}
      />

      {/* Document Selector */}
      <DocumentSelector
        open={isDocumentSelectorOpen}
        onOpenChange={setIsDocumentSelectorOpen}
        selectedDocuments={validSelectedDocuments}
        onToggleDocument={toggleDocument}
      />
    </div>
  );
}
