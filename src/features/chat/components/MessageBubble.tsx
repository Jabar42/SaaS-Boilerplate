import type { ChatMessage } from '../types/chat.types';

type MessageBubbleProps = {
  message: ChatMessage;
};

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={`mb-4 rounded-lg p-4 ${
        isUser
          ? 'ml-auto max-w-[80%] bg-primary text-primary-foreground'
          : 'mr-auto max-w-[80%] bg-muted'
      }`}
    >
      <div className="mb-1 text-xs font-semibold opacity-70">
        {isUser ? 'You' : 'AI'}
      </div>
      <div className="whitespace-pre-wrap">
        {message.parts
          ?.filter(part => part.type === 'text')
          .map((part) => {
            // Create unique key using message id, text hash, and length
            // to ensure uniqueness even with duplicate text
            const textHash = part.text
              .split('')
              .reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0);
            // Add length and first/last chars to ensure uniqueness
            const uniqueSuffix = `${Math.abs(textHash)}-${part.text.length}-${part.text.slice(0, 1)}${part.text.slice(-1)}`;
            const partKey = `${message.id}-${uniqueSuffix}`;
            return (
              <span key={partKey}>{part.text}</span>
            );
          }) || message.content || 'No content'}
      </div>
    </div>
  );
}
