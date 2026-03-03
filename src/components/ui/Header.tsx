interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-[#121212]/95 backdrop-blur-md shadow-lg">
      <div className="px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] sm:text-xs text-gray-400 tracking-[0.2em] uppercase mb-0.5">
            Equipa M6 APC TRABLISA
          </p>
          <h2 className="text-xl sm:text-2xl font-bold text-white leading-tight truncate">
            {title}
          </h2>
        </div>
        <div className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-[#1A237E] to-[#B71C1C] flex items-center justify-center text-xl sm:text-2xl ring-2 ring-white/60 shadow-[0_0_16px_rgba(255,255,255,0.2)]">
          🎾
        </div>
      </div>
      <div className="h-[3px] w-full bg-gradient-to-r from-[#1A237E] to-[#B71C1C]" aria-hidden />
    </header>
  );
}
