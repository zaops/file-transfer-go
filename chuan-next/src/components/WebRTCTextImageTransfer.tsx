"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Send, Download, X } from 'lucide-react';
import { WebRTCTextSender } from '@/components/webrtc/WebRTCTextSender';
import { WebRTCTextReceiver } from '@/components/webrtc/WebRTCTextReceiver';
import { useWebRTCStore } from '@/hooks/webrtc/webRTCStore';

export const WebRTCTextImageTransfer: React.FC = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // 状态管理
  const [mode, setMode] = useState<'send' | 'receive'>('send');
  const [hasProcessedInitialUrl, setHasProcessedInitialUrl] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  // 使用全局WebRTC状态
  const webrtcState = useWebRTCStore();

  // 从URL参数中获取初始模式
  useEffect(() => {
    const urlMode = searchParams.get('mode') as 'send' | 'receive';
    const type = searchParams.get('type');
    const code = searchParams.get('code');
    
    if (!hasProcessedInitialUrl && type === 'message' && urlMode && ['send', 'receive'].includes(urlMode)) {
      console.log('=== 处理初始URL参数 ===');
      console.log('URL模式:', urlMode, '类型:', type, '取件码:', code);
      
      setMode(urlMode);
      setHasProcessedInitialUrl(true);
    }
  }, [searchParams, hasProcessedInitialUrl]);

  // 更新URL参数
  const updateMode = useCallback((newMode: 'send' | 'receive') => {
    console.log('=== 切换模式 ===', newMode);
    
    setMode(newMode);
    const params = new URLSearchParams(searchParams.toString());
    params.set('type', 'message');
    params.set('mode', newMode);
    
    if (newMode === 'send') {
      params.delete('code');
    }
    
    router.push(`?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  // 重新开始函数
  const handleRestart = useCallback(() => {
    setPreviewImage(null);
    
    const params = new URLSearchParams(searchParams.toString());
    params.set('type', 'message');
    params.set('mode', mode);
    params.delete('code');
    router.push(`?${params.toString()}`, { scroll: false });
  }, [searchParams, mode, router]);

  const code = searchParams.get('code') || '';

  // 连接状态变化处理 - 现在不需要了，因为使用全局状态
  const handleConnectionChange = useCallback((connection: any) => {
    // 这个函数现在可能不需要了，但为了兼容现有的子组件接口，保留它
    console.log('连接状态变化:', connection);
  }, []);

  // 关闭图片预览
  const closePreview = useCallback(() => {
    setPreviewImage(null);
  }, []);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 模式切换 */}
      <div className="flex justify-center mb-6">
        <div className="bg-white/80 backdrop-blur-sm rounded-xl p-1 shadow-lg">
          <Button
            variant={mode === 'send' ? 'default' : 'ghost'}
            onClick={() => updateMode('send')}
            className="px-6 py-2 rounded-lg"
          >
            <Send className="w-4 h-4 mr-2" />
            发送文字
          </Button>
          <Button
            variant={mode === 'receive' ? 'default' : 'ghost'}
            onClick={() => updateMode('receive')}
            className="px-6 py-2 rounded-lg"
          >
            <Download className="w-4 h-4 mr-2" />
            加入房间
          </Button>
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-4 sm:p-6 animate-fade-in-up">
   
        
        {mode === 'send' ? (
          <WebRTCTextSender 
            onRestart={handleRestart} 
            onPreviewImage={setPreviewImage} 
            onConnectionChange={handleConnectionChange}
          />
        ) : (
          <WebRTCTextReceiver 
            initialCode={code} 
            onPreviewImage={setPreviewImage} 
            onRestart={handleRestart}
            onConnectionChange={handleConnectionChange}
          />
        )}
      </div>

      {/* 图片预览模态框 */}
      {previewImage && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" onClick={closePreview}>
          <div className="relative max-w-4xl max-h-4xl">
            <img src={previewImage} alt="预览" className="max-w-full max-h-full" />
            <Button
              onClick={closePreview}
              className="absolute top-4 right-4 bg-white text-black hover:bg-gray-200"
              size="sm"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
