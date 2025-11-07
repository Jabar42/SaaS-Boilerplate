'use client';

import { File } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/utils/Helpers';

type ChatInputProps = {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  onDocumentClick?: () => void;
  selectedDocumentsCount?: number;
};

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = 'Say something...',
  onDocumentClick,
  selectedDocumentsCount = 0,
}: ChatInputProps) {
  const [input, setInput] = useState('');
  const { state } = useSidebar();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !disabled) {
      onSend(input);
      setInput('');
    }
  };

  // Calcular el left según el estado del sidebar
  // Cuando está expandido: usa --sidebar-width (16rem)
  // Cuando está colapsado: usa --sidebar-width-icon (3rem)
  const leftClass = state === 'expanded'
    ? 'md:left-[var(--sidebar-width)]'
    : 'md:left-[var(--sidebar-width-icon)]';

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        'fixed inset-x-0 bottom-0 z-10 border-t bg-background transition-[left] duration-200 ease-linear',
        leftClass,
      )}
    >
      <div className="mx-auto max-w-screen-xl px-6 py-4">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.currentTarget.value)}
            placeholder={placeholder}
            disabled={disabled}
            className="flex-1"
          />
          {onDocumentClick && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onDocumentClick}
              disabled={disabled}
              className="relative"
              aria-label="Seleccionar documentos"
            >
              <File className="size-4" />
              {selectedDocumentsCount > 0 && (
                <Badge
                  variant="default"
                  className="absolute -right-2 -top-2 flex size-5 items-center justify-center p-0 text-xs"
                >
                  {selectedDocumentsCount}
                </Badge>
              )}
            </Button>
          )}
          <Button type="submit" disabled={disabled || !input.trim()}>
            Send
          </Button>
        </div>
      </div>
    </form>
  );
}
