import { memo, useMemo } from 'react';
import type { CanvasNode, CanvasNodeType } from '../../lib/api';

interface ClusterBubbleProps {
  node: CanvasNode;
  x: number;
  y: number;
  onClick: (node: CanvasNode) => void;
}

function stringToHue(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash % 360);
}

function getNodeStyle(nodeType: CanvasNodeType, label: string) {
  const hue = stringToHue(label);

  switch (nodeType) {
    case 'category':
      return {
        borderStyle: 'solid' as const,
        borderColor: `hsla(${hue}, 50%, 50%, 0.6)`,
        bgColor: `hsla(${hue}, 40%, 20%, 0.3)`,
        width: 200,
      };
    case 'tag':
      return {
        borderStyle: 'solid' as const,
        borderColor: `hsla(${hue}, 50%, 50%, 0.5)`,
        bgColor: `hsla(${hue}, 30%, 22%, 0.25)`,
        width: 180,
      };
    case 'semantic_cluster':
      return {
        borderStyle: 'dashed' as const,
        borderColor: `hsla(${hue}, 40%, 50%, 0.4)`,
        bgColor: `hsla(${hue}, 25%, 25%, 0.2)`,
        width: 190,
      };
    default:
      return {
        borderStyle: 'solid' as const,
        borderColor: 'var(--color-border)',
        bgColor: 'var(--color-bg-card)',
        width: 160,
      };
  }
}

export const ClusterBubble = memo(function ClusterBubble({
  node,
  x,
  y,
  onClick,
}: ClusterBubbleProps) {
  const style = useMemo(() => getNodeStyle(node.node_type, node.label), [node.node_type, node.label]);

  const typeLabel = useMemo(() => {
    switch (node.node_type) {
      case 'category': return '';
      case 'tag': return '';
      case 'semantic_cluster': return 'cluster';
      default: return '';
    }
  }, [node.node_type]);

  return (
    <div
      className="absolute cursor-pointer select-none transition-all duration-150 hover:scale-[1.03]"
      style={{
        left: x,
        top: y,
        transform: 'translate(-50%, -50%)',
        width: `${style.width}px`,
      }}
      onClick={() => onClick(node)}
    >
      <div
        className="rounded-lg px-4 py-3 border-2 backdrop-blur-sm"
        style={{
          borderStyle: style.borderStyle,
          borderColor: style.borderColor,
          backgroundColor: style.bgColor,
        }}
      >
        {/* Type badge */}
        {typeLabel && (
          <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)] block mb-1">
            {typeLabel}
          </span>
        )}

        {/* Label */}
        <p className="text-sm font-medium text-[var(--color-text-primary)] line-clamp-2 break-words">
          {node.label}
        </p>

        {/* Atom count */}
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-xs text-[var(--color-text-secondary)]">
            {node.atom_count} atom{node.atom_count !== 1 ? 's' : ''}
          </span>

          {/* Dominant tags for clusters */}
          {node.node_type === 'semantic_cluster' && node.dominant_tags.length > 0 && (
            <span className="text-[10px] text-[var(--color-text-tertiary)] truncate">
              {node.dominant_tags.slice(0, 2).join(', ')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});
