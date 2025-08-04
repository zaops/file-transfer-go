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
                  className="flex items-center justify-center space-x-2 px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 hover:bg-slate-50 data-[state=active]:bg-emerald-500 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:hover:bg-emerald-600"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span className="hidden sm:inline">文本传输</span>
                  <span className="sm:hidden">文本</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="desktop" 
                  className="flex items-center justify-center space-x-2 px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 hover:bg-slate-50 data-[state=active]:bg-purple-500 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:hover:bg-purple-600"
                >
                  <Monitor className="w-4 h-4" />
                  <span className="hidden sm:inline">共享桌面</span>
                  <span className="sm:hidden">桌面</span>
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Tab Content */}
            <div>
              <TabsContent value="webrtc" className="mt-0 animate-fade-in-up">
                <WebRTCFileTransfer />
              </TabsContent>

              <TabsContent value="text" className="mt-0 animate-fade-in-up">
                <TextTransfer
                  onSendText={async (text: string) => {
                    try {
                      const response = await fetch('/api/create-text-room', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ text }),
                      });

                      const data = await response.json();
                      
                      if (!response.ok) {
                        throw new Error(data.error || '创建文本房间失败');
                      }

                      return data.code;
                    } catch (error) {
                      console.error('创建文本房间失败:', error);
                      throw error;
                    }
                  }}
                  onReceiveText={async (code: string) => {
                    try {
                      const response = await fetch(`/api/get-text-content?code=${code}`);
                      const data = await response.json();
                      
                      if (!response.ok) {
                        throw new Error(data.error || '获取文本内容失败');
                      }

                      return data.text;
                    } catch (error) {
                      console.error('获取文本内容失败:', error);
                      throw error;
                    }
                  }}
                />
              </TabsContent>

              <TabsContent value="desktop" className="mt-0 animate-fade-in-up">
                <DesktopShare />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
