'use client';

import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';

type MessageSuggestionsProps = {
  onSuggestionClick: (suggestion: string) => void;
};

export function MessageSuggestions({ onSuggestionClick }: MessageSuggestionsProps) {
  const t = useTranslations('Chat');

  // Obtener sugerencias desde traducciones
  const suggestions = t.raw('suggestions') as string[];

  if (!suggestions || suggestions.length === 0) {
    return null;
  }

  // Función para truncar texto a 25 caracteres
  const truncateText = (text: string, maxLength: number = 25): string => {
    if (text.length <= maxLength) {
      return text;
    }
    return `${text.slice(0, maxLength)}...`;
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="mb-2 text-sm text-muted-foreground">
        {t('suggestions_title')}
      </p>
      <div className="flex max-w-2xl flex-wrap justify-center gap-2">
        {suggestions.map(suggestion => (
          <Button
            key={suggestion}
            variant="outline"
            size="sm"
            onClick={() => onSuggestionClick(suggestion)}
            className="text-left"
            title={suggestion}
          >
            {truncateText(suggestion)}
          </Button>
        ))}
      </div>
    </div>
  );
}
