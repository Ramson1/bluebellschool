"use client";

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';

// Dynamically import the TermlyFees component to avoid SSR issues
const TermlyFees = dynamic(() => import('../../src/pages_components/TermlyFees'), {
  ssr: false,
  loading: () => <div>Loading...</div>
});

export default function TermlyFeesPage() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <div>Loading...</div>;
  }

  return <TermlyFees />;
}