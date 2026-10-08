"use client";

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';

// Dynamically import the DataTools component to avoid SSR issues
const DataTools = dynamic(() => import('../../src/pages_components/DataTools'), {
  ssr: false,
  loading: () => <div>Loading...</div>
});

export default function DataToolsPage() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <div>Loading...</div>;
  }

  return <DataTools />;
}
