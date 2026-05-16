import type { ReactNode } from 'react';

interface MobileFrameProps {
  children: ReactNode;
}

export function MobileFrame({ children }: MobileFrameProps) {
  return (
    <div className="min-h-screen bg-stone-950 md:flex md:items-center md:justify-center md:p-8">
      <div className="
        relative h-screen w-screen overflow-hidden bg-stone-100
        md:h-[844px] md:w-[390px]
        md:rounded-[44px] md:border md:border-stone-800/40
        md:shadow-[0_60px_120px_-20px_rgba(0,0,0,0.6),0_30px_60px_-30px_rgba(0,0,0,0.5)]
      ">
        <div className="hidden md:block absolute top-2 left-1/2 -translate-x-1/2 z-30 h-7 w-28 rounded-full bg-stone-950" />
        {children}
      </div>
    </div>
  );
}
