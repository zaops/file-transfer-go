"use client";

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, MessageSquare, Monitor } from 'lucide-react';
import Hero from '@/components/Hero';
import { WebRTCFileTransfer } from '@/components/WebRTCFileTransfer';
import TextTransferWrapper from '@/components/TextTransferWrapper';

export default function HomePage() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState('message');
  const [hasInitialized, setHasInitialized] = useState(false);
  
  // 根据URL参数设置初始标签（仅首次加载时）
  useEffect(() => {
    if (!hasInitialized) {
      const urlType = searchParams.get('type');
      
      console.log('=== HomePage URL处理 ===');
      console.log('URL type参数:', urlType);
      console.log('所有搜索参数:', Object.fromEntries(searchParams.entries()));
      
      // 将旧的text类型重定向到message
      if (urlType === 'text') {
        console.log('检测到text类型，重定向到message标签页');
        setActiveTab('message');
      } else if (urlType === 'webrtc') {
        // webrtc类型对应文件传输标签页
        console.log('检测到webrtc类型，切换到webrtc标签页（文件传输）');
        setActiveTab('webrtc');
      } else if (urlType && ['message', 'desktop'].includes(urlType)) {
        console.log('切换到对应标签页:', urlType);
        setActiveTab(urlType);
      } else {
        console.log('没有有效的type参数，保持默认标签页');
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
              <TabsList className="grid w-full grid-cols-3 max-w-xl mx-auto h-auto bg-white/90 backdrop-blur-sm shadow-lg rounded-xl p-2 border border-slate-200">
                <TabsTrigger 
                  value="webrtc" 
                  className="flex items-center justify-center space-x-2 px-3 py-3 text-sm font-medium rounded-lg transition-all duration-200 hover:bg-slate-50 data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:hover:bg-blue-600"
                >
                  <Upload className="w-4 h-4" />
                  <span className="hidden sm:inline">文件传输</span>
                  <span className="sm:hidden">文件</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="message" 
                  className="flex items-center justify-center space-x-2 px-3 py-3 text-sm font-medium rounded-lg transition-all duration-200 hover:bg-slate-50 data-[state=active]:bg-emerald-500 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:hover:bg-emerald-600"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span className="hidden sm:inline">文本消息</span>
                  <span className="sm:hidden">消息</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="desktop" 
                  className="flex items-center justify-center space-x-2 px-3 py-3 text-sm font-medium rounded-lg transition-all duration-200 hover:bg-slate-50 data-[state=active]:bg-purple-500 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:hover:bg-purple-600 relative"
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

              <TabsContent value="message" className="mt-0 animate-fade-in-up">
                <TextTransferWrapper />
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
