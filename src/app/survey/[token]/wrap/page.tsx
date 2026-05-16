'use client';
import { use } from 'react';
import { MobileFrame } from '@/components/MobileFrame';
import { WrapScreen } from '@/components/WrapScreen';

export default function WrapPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  return (
    <MobileFrame>
      <WrapScreen token={token} />
    </MobileFrame>
  );
}
