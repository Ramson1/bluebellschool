"use client";

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';

// Dynamically import the FullPayment component to avoid SSR issues
const FullPayment = dynamic(() => import('../../src/pages_components/FullPayment'), {
  ssr: false,
  loading: () => <div>Loading...</div>
});

export default function FullPaymentPage() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <div>Loading...</div>;
  }

  return <FullPayment />;
}