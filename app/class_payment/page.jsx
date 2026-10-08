"use client";

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';

// Dynamically import the ClassPayment component to avoid SSR issues
const ClassPayment = dynamic(() => import('../../src/pages_components/ClassPayment'), {
  ssr: false,
  loading: () => <div>Loading...</div>
});

export default function ClassPaymentPage() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <div>Loading...</div>;
  }

  return <ClassPayment />;
}