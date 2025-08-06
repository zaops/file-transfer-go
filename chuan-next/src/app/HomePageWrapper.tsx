"use client";

import { Suspense } from 'react';
import HomePage from './HomePage';

function HomePageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">加载中...</div>}>
      <HomePage />
    </Suspense>
  );
}

export default HomePageWrapper;
