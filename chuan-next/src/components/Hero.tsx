"use client";

import React from 'react';

export default function Hero() {
  return (
    <div className="text-center mb-8 sm:mb-12 animate-fade-in-up">
      <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent mb-4">
        文件快传
      </h1>
      <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed px-4">
        安全、快速、简单的传输服务
        <br />
        <span className="text-sm sm:text-base text-slate-500">支持文件、文字、桌面共享 - 无需注册，即传即用</span>
      </p>
    </div>
  );
}
