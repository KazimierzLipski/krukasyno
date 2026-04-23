'use client';
import { useSession } from 'next-auth/react';
import { BlackjackTable } from '@/components/games/BlackjackTable';

export default function BlackjackPage() {
  const { data: session } = useSession();
  if (!session?.applicationToken) return null;
  return <BlackjackTable token={session.applicationToken} />;
}
