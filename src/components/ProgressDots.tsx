interface ProgressDotsProps {
  total: number;
  filled: number;
}

export function ProgressDots({ total, filled }: ProgressDotsProps) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`
            h-1 rounded-full transition-all duration-300
            ${i < filled ? 'w-6 bg-white' : 'w-1.5 bg-white/40'}
          `}
        />
      ))}
    </div>
  );
}
