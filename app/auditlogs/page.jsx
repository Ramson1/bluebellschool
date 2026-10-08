"use client";

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';

// Dynamically import the AuditLogs component to avoid SSR issues
const AuditLogs = dynamic(() => import('../../src/pages_components/AuditLogs'), {
  ssr: false,
  loading: () => <div>Loading...</div>
});

export default function AuditLogsPage() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <div>Loading...</div>;
  }

  return <AuditLogs />;
}
