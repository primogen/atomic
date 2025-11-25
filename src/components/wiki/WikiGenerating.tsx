interface WikiGeneratingProps {
  tagName: string;
  atomCount: number;
}

export function WikiGenerating({ tagName, atomCount }: WikiGeneratingProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-12 text-center">
      {/* Spinner */}
      <div className="w-16 h-16 mb-6">
        <svg className="w-full h-full animate-spin text-[#7c3aed]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
      
      <h3 className="text-lg font-medium text-[#dcddde] mb-2">
        Synthesizing article about "{tagName}"...
      </h3>
      
      <p className="text-sm text-[#888888]">
        Processing {atomCount} source{atomCount !== 1 ? 's' : ''}
      </p>
      
      <p className="text-xs text-[#666666] mt-4">
        This may take a moment
      </p>
    </div>
  );
}

