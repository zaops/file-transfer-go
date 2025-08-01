"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Share, Monitor, Copy, Play, Square } from 'lucide-react';
import { useToast } from '@/components/ui/toast-simple';

interface DesktopShareProps {
  onStartSharing?: () => Promise<string>; // 返回连接码
  onStopSharing?: () => Promise<void>;
  onJoinSharing?: (code: string) => Promise<void>;
}

export default function DesktopShare({ onStartSharing, onStopSharing, onJoinSharing }: DesktopShareProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [mode, setMode] = useState<'share' | 'view'>('share');
  const [connectionCode, setConnectionCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [isViewing, setIsViewing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { showToast } = useToast();

  // 从URL参数中获取初始模式
  useEffect(() => {
    const urlMode = searchParams.get('mode');
    const type = searchParams.get('type');
    
    if (type === 'desktop' && urlMode) {
      // 将send映射为share，receive映射为view
      if (urlMode === 'send') {
        setMode('share');
      } else if (urlMode === 'receive') {
        setMode('view');
      }
    }
  }, [searchParams]);

  // 更新URL参数
  const updateMode = useCallback((newMode: 'share' | 'view') => {
    setMode(newMode);
    const params = new URLSearchParams(searchParams.toString());
    params.set('type', 'desktop');
    // 将share映射为send，view映射为receive以保持一致性
    params.set('mode', newMode === 'share' ? 'send' : 'receive');
    router.push(`?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  const handleStartSharing = useCallback(async () => {
    if (!onStartSharing) return;
    
    setIsLoading(true);
    try {
      const code = await onStartSharing();
      setConnectionCode(code);
      setIsSharing(true);
      showToast('桌面共享已开始！', 'success');
    } catch (error) {
      console.error('开始共享失败:', error);
      showToast('开始共享失败，请重试', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [onStartSharing, showToast]);

  const handleStopSharing = useCallback(async () => {
    if (!onStopSharing) return;
    
    setIsLoading(true);
    try {
      await onStopSharing();
      setIsSharing(false);
      setConnectionCode('');
      showToast('桌面共享已停止', 'success');
    } catch (error) {
      console.error('停止共享失败:', error);
      showToast('停止共享失败', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [onStopSharing, showToast]);

  const handleJoinSharing = useCallback(async () => {
    if (!inputCode.trim() || !onJoinSharing) return;
    
    setIsLoading(true);
    try {
      await onJoinSharing(inputCode);
      setIsViewing(true);
      showToast('已连接到桌面共享！', 'success');
    } catch (error) {
      console.error('连接失败:', error);
      showToast('连接失败，请检查连接码', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [inputCode, onJoinSharing, showToast]);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast('已复制到剪贴板！', 'success');
    } catch (err) {
      showToast('复制失败', 'error');
    }
  }, [showToast]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 模式切换 */}
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

      {mode === 'share' ? (
        <div className="glass-card rounded-2xl p-4 sm:p-6 animate-fade-in-up">
          <div className="text-center mb-6">
            <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center animate-float">
              <Share className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold text-slate-800 mb-2">共享桌面</h2>
            <p className="text-sm sm:text-base text-slate-600">
              {isSharing ? '桌面共享进行中' : '开始共享您的桌面屏幕'}
            </p>
          </div>

          <div className="space-y-4">
            {!isSharing ? (
              <Button
                onClick={handleStartSharing}
                disabled={isLoading}
                className="w-full h-12 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-lg font-medium rounded-xl shadow-lg"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    启动中...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 mr-2" />
                    开始共享桌面
                  </>
                )}
              </Button>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200">
                  <div className="text-center">
                    <p className="text-sm text-purple-700 mb-2">连接码</p>
                    <div className="text-2xl font-bold font-mono text-purple-600 mb-3">{connectionCode}</div>
                    <Button
                      onClick={() => copyToClipboard(connectionCode)}
                      size="sm"
                      className="bg-purple-500 hover:bg-purple-600 text-white"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      复制连接码
                    </Button>
                  </div>
                </div>

                <Button
                  onClick={handleStopSharing}
                  disabled={isLoading}
                  className="w-full h-12 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white text-lg font-medium rounded-xl shadow-lg"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      停止中...
                    </>
                  ) : (
                    <>
                      <Square className="w-5 h-5 mr-2" />
                      停止共享
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="glass-card rounded-2xl p-4 sm:p-6 animate-fade-in-up">
          <div className="text-center mb-6">
            <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center animate-float">
              <Monitor className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold text-slate-800 mb-2">观看桌面</h2>
            <p className="text-sm sm:text-base text-slate-600">
              {isViewing ? '正在观看桌面共享' : '输入连接码观看他人的桌面'}
            </p>
          </div>

          <div className="space-y-4">
            {!isViewing ? (
              <>
                <Input
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase().slice(0, 6))}
                  placeholder="请输入连接码"
                  className="text-center text-2xl sm:text-3xl tracking-[0.3em] sm:tracking-[0.5em] font-mono h-12 sm:h-16 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-indigo-500 bg-white/80 backdrop-blur-sm"
                  maxLength={6}
                  disabled={isLoading}
                />

                <Button
                  onClick={handleJoinSharing}
                  disabled={inputCode.length !== 6 || isLoading}
                  className="w-full h-12 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white text-lg font-medium rounded-xl shadow-lg"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      连接中...
                    </>
                  ) : (
                    <>
                      <Monitor className="w-5 h-5 mr-2" />
                      连接桌面
                    </>
                  )}
                </Button>
              </>
            ) : (
              <div className="space-y-4">
                <div className="aspect-video bg-slate-900 rounded-xl flex items-center justify-center text-white">
                  <div className="text-center">
                    <Monitor className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm opacity-75">桌面共享画面</p>
                  </div>
                </div>

                <Button
                  onClick={() => setIsViewing(false)}
                  className="w-full h-12 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white text-lg font-medium rounded-xl shadow-lg"
                >
                  <Square className="w-5 h-5 mr-2" />
                  断开连接
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
