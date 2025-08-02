"use client";

import React from 'react';

export default function Hero() {
  return (
    <div className="text-center mb-6 animate-fade-in-up">
      <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent mb-2">
        文件快传
      </h1>
      <p className="text-sm sm:text-base text-slate-600 max-w-xl mx-auto leading-relaxed px-4 mb-3">
        安全、快速、简单的传输服务
        <br />
        <span className="text-xs sm:text-sm text-slate-500">支持文件、文字、桌面共享 - 无需注册，即传即用</span>
      </p>
      
      {/* 分割线 */}
      <div className="w-64 sm:w-80 md:w-96 lg:w-[32rem] xl:w-[40rem] h-0.5 bg-gradient-to-r from-blue-400 via-purple-400 to-indigo-400 mx-auto mt-4 mb-2 opacity-60"></div>
    </div>
  );
}
