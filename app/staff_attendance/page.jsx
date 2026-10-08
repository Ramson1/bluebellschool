"use client";

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';

// Dynamically import the StaffAttendance component to avoid SSR issues
const StaffAttendance = dynamic(() => import('../../src/pages_components/StaffAttendance'), {
  ssr: false,
  loading: () => <div>Loading...</div>
});

export default function StaffAttendancePage() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <div>Loading...</div>;
  }

  return <StaffAttendance />;
}
