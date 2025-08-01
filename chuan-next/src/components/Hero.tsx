"use client";

import React from 'react';
import { Github } from 'lucide-react';

export default function Hero() {
  return (
    <div className="text-center mb-8 sm:mb-12 animate-fade-in-up">
      <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent mb-4">
        文件快传
      </h1>
      <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed px-4 mb-4">
        安全、快速、简单的传输服务
        <br />
        <span className="text-sm sm:text-base text-slate-500">支持文件、文字、桌面共享 - 无需注册，即传即用</span>
      </p>
      
      {/* GitHub开源链接 */}
      <div className="flex flex-col items-center space-y-2">
        <a
          href="https://github.com/MatrixSeven/file-transfer-go"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm rounded-lg transition-all duration-200 hover:scale-105 transform border border-slate-200 hover:border-slate-300"
        >
          <Github className="w-4 h-4" />
          <span>开源项目</span>
        </a>
        <a
          href="https://github.com/MatrixSeven/file-transfer-go"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-slate-400 font-mono hover:text-slate-600 transition-colors duration-200 hover:underline"
        >
          https://github.com/MatrixSeven/file-transfer-go
        </a>
      </div>
    </div>
  );
}
