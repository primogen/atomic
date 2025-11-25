interface CitationLinkProps {
  index: number;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

export function CitationLink({ index, onClick }: CitationLinkProps) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center justify-center text-[#7c3aed] hover:text-[#a78bfa] hover:underline transition-colors text-sm font-medium mx-0.5"
    >
      [{index}]
    </button>
  );
}

