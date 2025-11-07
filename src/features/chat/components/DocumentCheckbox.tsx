'use client';

import { CheckSquare2, Loader2, Square } from 'lucide-react';

import { cn } from '@/utils/Helpers';

type DocumentCheckboxProps = {
  checked: boolean;
  loading?: boolean;
  onToggle: () => void;
  className?: string;
};

export function DocumentCheckbox({
  checked,
  loading = false,
  onToggle,
  className,
}: DocumentCheckboxProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={loading}
      className={cn(
        'cursor-pointer transition-colors',
        checked && !loading
          ? 'text-primary'
          : 'text-muted-foreground hover:text-foreground',
        loading && 'cursor-wait',
        className,
      )}
      aria-label={checked ? 'Deseleccionar documento' : 'Seleccionar documento'}
    >
      {loading
        ? (
            <Loader2 className="size-4 animate-spin" />
          )
        : checked
          ? (
              <CheckSquare2 className="size-4" />
            )
          : (
              <Square className="size-4" />
            )}
    </button>
  );
}
