"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Share, Monitor } from 'lucide-react';
import  WebRTCDesktopReceiver from '@/components/webrtc/WebRTCDesktopReceiver';
import  WebRTCDesktopSender from '@/components/webrtc/WebRTCDesktopSender';


interface DesktopShareProps {
  // 保留向后兼容性的props（已废弃，但保留接口）
  onStartSharing?: () => Promise<string>;
  onStopSharing?: () => Promise<void>;
  onJoinSharing?: (code: string) => Promise<void>;
}

export default function DesktopShare({ 
  onStartSharing, 
  onStopSharing, 
  onJoinSharing 
}: DesktopShareProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [mode, setMode] = useState<'share' | 'view'>('share');

  // 从URL参数中获取初始模式和房间代码
  useEffect(() => {
    const urlMode = searchParams.get('mode');
    const type = searchParams.get('type');
    const urlCode = searchParams.get('code');
    
    if (type === 'desktop' && urlMode) {
      if (urlMode === 'send') {
        setMode('share');
      } else if (urlMode === 'receive') {
        setMode('view');
        // 如果URL中有房间代码，将在DesktopShareReceiver组件中自动加入
      }
    }
  }, [searchParams]);

  // 更新URL参数
  const updateMode = useCallback((newMode: 'share' | 'view') => {
    setMode(newMode);
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('type', 'desktop');
    currentUrl.searchParams.set('mode', newMode === 'share' ? 'send' : 'receive');
    // 清除代码参数，避免模式切换时的混乱
    currentUrl.searchParams.delete('code');
    router.replace(currentUrl.pathname + currentUrl.search);
  }, [router]);

  // 获取初始房间代码（用于接收者模式）
  const getInitialCode = useCallback(() => {
    const urlMode = searchParams.get('mode');
    const type = searchParams.get('type');
    const code = searchParams.get('code');
    console.log('[DesktopShare] getInitialCode 调用, URL参数:', { type, urlMode, code });
    
    if (type === 'desktop' && urlMode === 'receive') {
      const result = code || '';
      console.log('[DesktopShare] getInitialCode 返回:', result);
      return result;
    }
    console.log('[DesktopShare] getInitialCode 返回空字符串');
    return '';
  }, [searchParams]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 模式选择器 */}
      <div className="flex justify-center mb-6">
        <div className="bg-white/80 backdrop-blur-sm rounded-xl p-1 shadow-lg">
          <Button
            variant={mode === 'share' ? 'default' : 'ghost'}
            onClick={() => updateMode('share')}
            className="px-6 py-2 rounded-lg"
          >
            <Share className="w-4 h-4 mr-2" />
            共享桌面
          </Button>
          <Button
            variant={mode === 'view' ? 'default' : 'ghost'}
            onClick={() => updateMode('view')}
            className="px-6 py-2 rounded-lg"
          >
            <Monitor className="w-4 h-4 mr-2" />
            观看桌面
          </Button>
        </div>
      </div>

      {/* 根据模式渲染对应的组件 */}
      {mode === 'share' ? (
        <WebRTCDesktopSender />
      ) : (
        <WebRTCDesktopReceiver 
          initialCode={getInitialCode()}
        />
      )}
    </div>
  );
}
