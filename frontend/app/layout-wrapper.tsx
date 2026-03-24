'use client';

import React, { ReactNode } from 'react';
import { ParamsProvider } from '@/lib/params-context';

export default function RootLayoutWrapper({
  children,
}: {
  children: ReactNode;
}) {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

  return (
    <ParamsProvider apiBaseUrl={apiBaseUrl}>
      {children}
    </ParamsProvider>
  );
}
