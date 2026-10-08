"use client";

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';

// Midterm entry now flows through the redesigned Result component (purpose = 'midterm').
// The old MidtermResult component was fully commented-out dead code, so this route
// now renders the live Result page instead of a blank screen.
const MidtermResult = dynamic(() => import('../../src/pages_components/Result'), {
  ssr: false,
  loading: () => <div>Loading...</div>
});

export default function MidtermResultPage() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <div>Loading...</div>;
  }

  return <MidtermResult />;
}