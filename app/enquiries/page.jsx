"use client";

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';

// Dynamically import the Enquiries component to avoid SSR issues
const Enquiries = dynamic(() => import('../../src/pages_components/Enquiries'), {
  ssr: false,
  loading: () => <div>Loading...</div>
});

export default function EnquiriesPage() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <div>Loading...</div>;
  }

  return <Enquiries />;
}
