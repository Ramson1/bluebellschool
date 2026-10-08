"use client";

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';

// Dynamically import the FullStudent component to avoid SSR issues
const FullStudent = dynamic(() => import('../../src/pages_components/FullStudent'), {
  ssr: false,
  loading: () => <div>Loading...</div>
});

export default function FullStudentPage() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <div>Loading...</div>;
  }

  return <FullStudent />;
}