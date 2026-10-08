"use client";

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';

// Dynamically import the review component to avoid SSR issues
const AdminLessonPlans = dynamic(() => import('../../src/components/AdminLessonPlans'), {
  ssr: false,
  loading: () => <div>Loading...</div>
});

export default function LessonPlansPage() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <div>Loading...</div>;
  }

  return <AdminLessonPlans />;
}
