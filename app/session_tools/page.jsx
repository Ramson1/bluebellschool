"use client";

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';

// Dynamically import the SessionTools component to avoid SSR issues
const SessionTools = dynamic(() => import('../../src/pages_components/SessionTools'), {
  ssr: false,
  loading: () => <div>Loading...</div>
});

export default function SessionToolsPage() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <div>Loading...</div>;
  }

  return <SessionTools />;
}
