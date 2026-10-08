"use client";

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';

// Dynamically import the AttendanceTaker component to avoid SSR issues
const AttendanceTaker = dynamic(() => import('../../src/pages_components/AttendanceTaker'), {
  ssr: false,
  loading: () => <div>Loading...</div>
});

export default function AttendancePage() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <div>Loading...</div>;
  }

  return <AttendanceTaker />;
}
