'use client';
import { useSession } from 'next-auth/react';
import { SlotMachine } from '@/components/games/SlotMachine';

export default function SlotsPage() {
  const { data: session } = useSession();
  if (!session?.applicationToken) return null;
  return <SlotMachine token={session.applicationToken} />;
}
