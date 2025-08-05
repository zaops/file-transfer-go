"use client";

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, MessageSquare, Monitor, Github, ExternalLink } from 'lucide-react';
import Hero from '@/components/Hero';
import TextTransfer from '@/components/TextTransfer';
import DesktopShare from '@/components/DesktopShare';
import { WebRTCFileTransfer } from '@/components/WebRTCFileTransfer';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState('webrtc');
  const [hasInitialized, setHasInitialized] = useState(false);
  
  // 根据URL参数设置初始标签（仅首次加载时）
  useEffect(() => {
    if (!hasInitialized) {
      const urlType = searchParams.get('type');
      if (urlType && ['webrtc', 'text', 'desktop'].includes(urlType)) {
        setActiveTab(urlType);
      }
      setHasInitialized(true);
    }
  }, [searchParams, hasInitialized]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto px-4 py-4 sm:py-6 md:py-8">
        {/* Hero Section */}
        <div className="text-center mb-6 sm:mb-8">
          <Hero />
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {/* Tabs Navigation - 横向布局 */}
            <div className="mb-6">
              <TabsList className="grid w-full grid-cols-3 max-w-lg mx-auto h-auto bg-white/90 backdrop-blur-sm shadow-lg rounded-xl p-2 border border-slate-200">
                <TabsTrigger 
                  value="webrtc" 
                  className="flex items-center justify-center space-x-2 px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 hover:bg-slate-50 data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:hover:bg-blue-600"
                >
                  <Upload className="w-4 h-4" />
                  <span className="hidden sm:inline">文件传输</span>
                  <span className="sm:hidden">文件</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="text" 
                  className="flex items-center justify-center space-x-2 px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 hover:bg-slate-50 data-[state=active]:bg-emerald-500 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:hover:bg-emerald-600 relative"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span className="hidden sm:inline">文本传输</span>
                  <span className="sm:hidden">文本</span>
                  <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded ml-1 absolute -top-1 -right-1">开发中</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="desktop" 
                  className="flex items-center justify-center space-x-2 px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 hover:bg-slate-50 data-[state=active]:bg-purple-500 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:hover:bg-purple-600 relative"
                >
                  <Monitor className="w-4 h-4" />
                  <span className="hidden sm:inline">共享桌面</span>
                  <span className="sm:hidden">桌面</span>
                  <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded ml-1 absolute -top-1 -right-1">开发中</span>
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Tab Content */}
            <div>
              <TabsContent value="webrtc" className="mt-0 animate-fade-in-up">
                <WebRTCFileTransfer />
              </TabsContent>

              <TabsContent value="text" className="mt-0 animate-fade-in-up">
                <div className="max-w-md mx-auto p-8 bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-200">
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-full flex items-center justify-center">
                      <MessageSquare className="w-8 h-8 text-emerald-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-slate-800 mb-2">文字传输</h3>
                    <p className="text-slate-600 mb-4">此功能正在开发中...</p>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                      <p className="text-sm text-emerald-700">
                        🚧 敬请期待！我们正在为您开发更便捷的文字传输功能
                      </p>
                    </div>
                    <p className="text-xs text-slate-500 mt-4">
                      目前请使用文件传输功能
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="desktop" className="mt-0 animate-fade-in-up">
                <div className="max-w-md mx-auto p-8 bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-200">
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-purple-100 to-purple-200 rounded-full flex items-center justify-center">
                      <Monitor className="w-8 h-8 text-purple-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-slate-800 mb-2">桌面共享</h3>
                    <p className="text-slate-600 mb-4">此功能正在开发中...</p>
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <p className="text-sm text-purple-700">
                        🚧 敬请期待！我们正在为您开发实时桌面共享功能
                      </p>
                    </div>
                    <p className="text-xs text-slate-500 mt-4">
                      目前请使用文件传输功能
                    </p>
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
