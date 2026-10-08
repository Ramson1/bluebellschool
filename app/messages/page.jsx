"use client";

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';

// Dynamically import the chat component to avoid SSR issues
const AdminChat = dynamic(() => import('../../src/components/AdminChat'), {
  ssr: false,
  loading: () => <div>Loading...</div>
});

export default function MessagesPage() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <div>Loading...</div>;
  }

  return <AdminChat />;
}
