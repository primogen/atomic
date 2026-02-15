import { memo } from 'react';
import type { BreadcrumbEntry } from '../../lib/api';

interface CanvasBreadcrumbProps {
  breadcrumb: BreadcrumbEntry[];
  onNavigate: (parentId: string | null) => void;
}

export const CanvasBreadcrumb = memo(function CanvasBreadcrumb({
  breadcrumb,
  onNavigate,
}: CanvasBreadcrumbProps) {
  return (
    <div className="flex items-center gap-1 px-4 py-2 text-sm border-b border-[var(--color-border)] bg-[var(--color-bg-card)] min-h-[36px]">
      <button
        onClick={() => onNavigate(null)}
        className={`px-2 py-0.5 rounded transition-colors ${
          breadcrumb.length === 0
            ? 'text-[var(--color-text-primary)] font-medium'
            : 'text-[var(--color-accent)] hover:text-[var(--color-accent-light)] hover:bg-[var(--color-bg-hover)]'
        }`}
      >
        Home
      </button>
      {breadcrumb.map((entry, i) => (
        <span key={entry.id} className="flex items-center gap-1">
          <span className="text-[var(--color-text-tertiary)]">/</span>
          <button
            onClick={() => onNavigate(entry.id)}
            className={`px-2 py-0.5 rounded transition-colors ${
              i === breadcrumb.length - 1
                ? 'text-[var(--color-text-primary)] font-medium'
                : 'text-[var(--color-accent)] hover:text-[var(--color-accent-light)] hover:bg-[var(--color-bg-hover)]'
            }`}
          >
            {entry.label}
          </button>
        </span>
      ))}
    </div>
  );
});
