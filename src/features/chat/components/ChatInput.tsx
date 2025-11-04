'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type ChatInputProps = {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = 'Say something...',
}: ChatInputProps) {
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !disabled) {
      onSend(input);
      setInput('');
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="fixed inset-x-0 bottom-0 z-10 border-t bg-background md:left-[var(--sidebar-width)]"
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
          <Button type="submit" disabled={disabled || !input.trim()}>
            Send
          </Button>
        </div>
      </div>
    </form>
  );
}
