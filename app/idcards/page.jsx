"use client";

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';

// Dynamically import the IdCards component to avoid SSR issues
const IdCards = dynamic(() => import('../../src/pages_components/IdCards'), {
  ssr: false,
  loading: () => <div>Loading...</div>
});

export default function IdCardsPage() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <div>Loading...</div>;
  }

  return <IdCards />;
}
