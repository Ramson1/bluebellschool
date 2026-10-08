"use client";

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';

// Dynamically import the RolesAccess (access control) component to avoid SSR issues
const RolesAccess = dynamic(() => import('../../src/pages_components/RolesAccess'), {
  ssr: false,
  loading: () => <div>Loading...</div>
});

export default function RolesAccessPage() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <div>Loading...</div>;
  }

  return <RolesAccess />;
}
