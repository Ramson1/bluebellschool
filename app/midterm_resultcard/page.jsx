"use client";

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';

// Dynamically import the MidtermResultCardComponent to avoid SSR issues
const MidtermResultCardComponent = dynamic(() => import('../../src/pages_components/MidtermResultCardComponent'), {
  ssr: false,
  loading: () => <div>Loading...</div>
});

export default function MidtermResultCardPage() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <div>Loading...</div>;
  }

  return <MidtermResultCardComponent />;
}