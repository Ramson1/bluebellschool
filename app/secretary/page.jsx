"use client";

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';

// Dynamically import the SecretaryView component to avoid SSR issues
const SecretaryView = dynamic(() => import('../../src/pages_components/SecretaryView'), {
  ssr: false,
  loading: () => <div>Loading...</div>
});

export default function SecretaryPage() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <div>Loading...</div>;
  }

  return <SecretaryView />;
}
