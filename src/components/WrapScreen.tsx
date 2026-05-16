'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFeed } from '@/lib/store';

interface WrapScreenProps {
  token: string;
}

export function WrapScreen({ token }: WrapScreenProps) {
  const router = useRouter();
  const setWrapNote = useFeed(s => s.setWrapNote);
  const complete = useFeed(s => s.complete);
  const [note, setNote] = useState('');

  const submit = () => {
    setWrapNote(note.trim());
    complete();
    router.push(`/brief/${token}`);
  };

  return (
    <div className="flex h-full w-full flex-col px-6 pt-20 pb-8 bg-stone-100">
      <div className="text-xs uppercase tracking-[0.3em] text-stone-500 mb-6">
        One last thing
      </div>
      <h2 className="font-serif text-3xl text-stone-900 leading-tight">
        Anything we should know about this trip?
      </h2>
      <p className="mt-3 text-sm text-stone-600">
        Allergies, celebrations, who you&apos;re traveling with, what you&apos;re here to do — anything at all. Or skip.
      </p>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={6}
        placeholder="Optional…"
        className="
          mt-6 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3
          text-stone-900 placeholder:text-stone-400 text-base
          focus:outline-none focus:ring-2 focus:ring-stone-900/20 focus:border-stone-400
          resize-none
        "
      />
      <button
        type="button"
        onClick={submit}
        className="
          mt-auto w-full rounded-full bg-stone-900 text-white py-4 font-medium text-base
          hover:bg-stone-800 transition-colors
        "
      >
        Send to my concierge
      </button>
    </div>
  );
}
