"use client";

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';

// Dynamically import the Receipt component to avoid SSR issues
const Receipt = dynamic(() => import('../../src/pages_components/Receipt'), {
  ssr: false,
  loading: () => <div>Loading...</div>
});

export default function ReceiptPage() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <div>Loading...</div>;
  }

  return <Receipt />;
}