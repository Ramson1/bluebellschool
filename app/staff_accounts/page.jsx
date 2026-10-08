"use client";

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';

// Dynamically import the StaffAccounts component to avoid SSR issues
const StaffAccounts = dynamic(() => import('../../src/pages_components/StaffAccounts'), {
  ssr: false,
  loading: () => <div>Loading...</div>
});

export default function StaffAccountsPage() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <div>Loading...</div>;
  }

  return <StaffAccounts />;
}
