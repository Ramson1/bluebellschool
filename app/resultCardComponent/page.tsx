"use client";

import React, { Suspense } from "react";
import ResultCardComponent from "../../src/pages_components/ResultCardComponent";
import { useSearchParams } from 'next/navigation';

function ResultCardComponentContent() {
  const searchParams = useSearchParams();
  
  // Get data from URL parameters
  const studentDataParam = searchParams.get('studentData');
  const passportParam = searchParams.get('passport');
  const selectedTermParam = searchParams.get('selectedTerm');
  const resultTypeParam = searchParams.get('resultType');
  
  // Parse the data
  console.log('Raw URL parameters in ResultCardComponent page:', {
    studentDataParam,
    passportParam,
    selectedTermParam,
    resultTypeParam
  });
  
  const studentData = studentDataParam ? JSON.parse(decodeURIComponent(studentDataParam)) : undefined;
  const passport = passportParam ? JSON.parse(decodeURIComponent(passportParam)) : undefined;
  const selectedTerm = selectedTermParam ? decodeURIComponent(selectedTermParam) : undefined;
  const resultType = resultTypeParam ? decodeURIComponent(resultTypeParam) : undefined;
  
  console.log('Parsed data in ResultCardComponent page:', {
    studentData,
    passport,
    selectedTerm,
    resultType
  });
  
  // Pass data as props to the component
  return <ResultCardComponent studentData={studentData} passport={passport} selectedTerm={selectedTerm} resultType={resultType} />;
}

export default function ResultCardComponentPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ResultCardComponentContent />
    </Suspense>
  );
}