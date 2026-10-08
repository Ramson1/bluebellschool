"use client";

import dynamic from "next/dynamic";
import { useState, useEffect } from "react";

// Dynamically import the ResultHistory component to avoid SSR issues
const ResultHistory = dynamic(() => import("../../src/pages_components/ResultHistory"), {
  ssr: false,
  loading: () => <div>Loading...</div>,
});

export default function ResultArchivePage() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <div>Loading...</div>;
  }

  return <ResultHistory />;
}
