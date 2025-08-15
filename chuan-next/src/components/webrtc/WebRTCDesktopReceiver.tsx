"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Monitor, Square } from 'lucide-react';
import { useToast } from '@/components/ui/toast-simple';
import { useDesktopShareBusiness } from '@/hooks/webrtc/useDesktopShareBusiness';
import DesktopViewer from '@/components/DesktopViewer';
import { ConnectionStatus } from '@/components/ConnectionStatus';

interface WebRTCDesktopReceiverProps {
  className?: string;
  initialCode?: string; // 支持从URL参数传入的房间代码
  onConnectionChange?: (connection: any) => void;
}

export default function WebRTCDesktopReceiver({ className, initialCode, onConnectionChange }: WebRTCDesktopReceiverProps) {
  const [inputCode, setInputCode] = useState(initialCode || '');
  const [isLoading, setIsLoading] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const hasTriedAutoJoin = React.useRef(false); // 添加 ref 来跟踪是否已尝试自动加入
  const { showToast } = useToast();

  // 使用桌面共享业务逻辑
  const desktopShare = useDesktopShareBusiness();

  // 通知父组件连接状态变化
  useEffect(() => {
    if (onConnectionChange && desktopShare.webRTCConnection) {
      onConnectionChange(desktopShare.webRTCConnection);
    }
  }, [onConnectionChange, desktopShare.isWebSocketConnected, desktopShare.isPeerConnected, desktopShare.isConnecting]);

  // 加入观看
  const handleJoinViewing = useCallback(async () => {
    if (!inputCode.trim()) {
      showToast('请输入房间代码', 'error');
      return;
    }

    try {
      setIsLoading(true);
      console.log('[DesktopShareReceiver] 用户加入观看房间:', inputCode);
      
      await desktopShare.joinSharing(inputCode.trim().toUpperCase());
      console.log('[DesktopShareReceiver] 加入观看成功');
      
      showToast('已加入桌面共享', 'success');
    } catch (error) {
      console.error('[DesktopShareReceiver] 加入观看失败:', error);
      const errorMessage = error instanceof Error ? error.message : '加入观看失败';
      showToast(errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [desktopShare, inputCode, showToast]);

  // 停止观看
  const handleStopViewing = useCallback(async () => {
    try {
      setIsLoading(true);
      await desktopShare.stopViewing();
      showToast('已退出桌面共享', 'success');
      setInputCode('');
    } catch (error) {
      console.error('[DesktopShareReceiver] 停止观看失败:', error);
      showToast('退出失败', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [desktopShare, showToast]);

  // 如果有初始代码且还未加入观看，自动尝试加入
  React.useEffect(() => {
    console.log('[WebRTCDesktopReceiver] useEffect 触发, 参数:', {
      initialCode,
      isViewing: desktopShare.isViewing,
      isConnecting: desktopShare.isConnecting,
      hasTriedAutoJoin: hasTriedAutoJoin.current
    });
    
    const autoJoin = async () => {
      if (initialCode && !desktopShare.isViewing && !desktopShare.isConnecting && !hasTriedAutoJoin.current) {
        hasTriedAutoJoin.current = true;
        console.log('[WebRTCDesktopReceiver] 检测到初始代码，自动加入观看:', initialCode);
        
        try {
          setIsLoading(true);
          await desktopShare.joinSharing(initialCode.trim().toUpperCase());
          console.log('[WebRTCDesktopReceiver] 自动加入观看成功');
          showToast('已加入桌面共享', 'success');
        } catch (error) {
          console.error('[WebRTCDesktopReceiver] 自动加入观看失败:', error);
          const errorMessage = error instanceof Error ? error.message : '加入观看失败';
          showToast(errorMessage, 'error');
        } finally {
          setIsLoading(false);
        }
      } else {
        console.log('[WebRTCDesktopReceiver] 不满足自动加入条件:', {
          hasInitialCode: !!initialCode,
          notViewing: !desktopShare.isViewing,
          notConnecting: !desktopShare.isConnecting,
          notTriedBefore: !hasTriedAutoJoin.current
        });
      }
    };
    
    autoJoin();
  }, [initialCode, desktopShare.isViewing, desktopShare.isConnecting]); // 移除了 desktopShare.joinSharing 和 showToast

  return (
    <div className={`space-y-4 sm:space-y-6 ${className || ''}`}>
      <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 sm:p-6 shadow-lg border border-white/20 animate-fade-in-up">
        <div className="space-y-6">
          {!desktopShare.isViewing ? (
            // 输入房间代码界面 - 与文本消息风格一致
            <div>
              <div className="flex items-center justify-between mb-6 sm:mb-8">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-xl flex items-center justify-center">
                    <Monitor className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-800">输入房间代码</h2>
                    <p className="text-sm text-slate-600">请输入6位房间代码来观看桌面共享</p>
                  </div>
                </div>
                
                <ConnectionStatus 
                  currentRoom={desktopShare.connectionCode ? { code: desktopShare.connectionCode, role: 'receiver' } : null}
                />
              </div>

              <form onSubmit={(e) => { e.preventDefault(); handleJoinViewing(); }} className="space-y-4 sm:space-y-6">
                <div className="space-y-3">
                  <div className="relative">
                    <Input
                      value={inputCode}
                      onChange={(e) => setInputCode(e.target.value.replace(/[^A-Z0-9]/g, '').toUpperCase())}
                      placeholder="请输入房间代码"
                      className="text-center text-2xl sm:text-3xl tracking-[0.3em] sm:tracking-[0.5em] font-mono h-12 sm:h-16 border-2 border-slate-200 rounded-xl focus:border-purple-500 focus:ring-purple-500 bg-white/80 backdrop-blur-sm pb-2 sm:pb-4"
                      maxLength={6}
                      disabled={isLoading}
                    />
                  </div>
                  <p className="text-center text-xs sm:text-sm text-slate-500">
                    {inputCode.length}/6 位
                  </p>
                </div>

                <div className="flex justify-center">
                  <Button
                    type="submit"
                    disabled={inputCode.length !== 6 || isLoading}
                    className="w-full h-10 sm:h-12 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white text-base sm:text-lg font-medium rounded-xl shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:scale-100"
                  >
                    {isLoading ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>连接中...</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <Monitor className="w-5 h-5" />
                        <span>加入观看</span>
                      </div>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          ) : (
            // 已连接，显示桌面观看界面
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center">
                    <Monitor className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800">桌面观看</h3>
                    <p className="text-sm text-slate-600">房间代码: {inputCode}</p>
                  </div>
                </div>

                {/* 连接状态 */}
                <ConnectionStatus 
                  currentRoom={{ code: inputCode, role: 'receiver' }}
                />
              </div>

              {/* 观看中的控制面板 */}
              <div className="flex justify-center mb-4">
                <div className="bg-white rounded-lg p-3 shadow-lg border flex items-center space-x-4">
                  <div className="flex items-center space-x-2 text-green-600">
                    <Monitor className="w-4 h-4" />
                    <span className="font-semibold">观看中</span>
                  </div>
                  <Button
                    onClick={handleStopViewing}
                    disabled={isLoading}
                    variant="destructive"
                    size="sm"
                  >
                    <Square className="w-4 h-4 mr-2" />
                    {isLoading ? '退出中...' : '退出观看'}
                  </Button>
                </div>
              </div>

              {/* 桌面显示区域 */}
              {desktopShare.remoteStream ? (
                <DesktopViewer 
                  stream={desktopShare.remoteStream} 
                  isConnected={desktopShare.isViewing}
                  connectionCode={inputCode}
                  onDisconnect={handleStopViewing}
                />
              ) : (
                <div className="bg-white/80 backdrop-blur-sm rounded-xl p-8 border border-slate-200">
                  <div className="text-center">
                    <Monitor className="w-16 h-16 mx-auto text-slate-400 mb-4" />
                    <p className="text-slate-600 mb-2">等待接收桌面画面...</p>
                    <p className="text-sm text-slate-500">发送方开始共享后，桌面画面将在这里显示</p>
                    
                    <div className="flex items-center justify-center space-x-2 mt-4">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500"></div>
                      <span className="text-sm text-purple-600">等待桌面流...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
