"use client";

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';

// Dynamically import the CbtQuestions component to avoid SSR issues
const CbtQuestions = dynamic(() => import('../../src/pages_components/CbtQuestions'), {
  ssr: false,
  loading: () => <div>Loading...</div>
});

export default function CBTQuestionsPage() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <div>Loading...</div>;
  }

  return <CbtQuestions />;
}