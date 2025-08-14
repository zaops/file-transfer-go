"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Share, Monitor, Copy, Play, Square, Repeat, Users, Wifi, WifiOff } from 'lucide-react';
import { useToast } from '@/components/ui/toast-simple';
import { useDesktopShareBusiness } from '@/hooks/webrtc/useDesktopShareBusiness';
import DesktopViewer from '@/components/DesktopViewer';
import QRCodeDisplay from '@/components/QRCodeDisplay';

interface DesktopShareProps {
  // 保留向后兼容性的props
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
  const [inputCode, setInputCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const { showToast } = useToast();

  // 使用桌面共享业务逻辑
  const desktopShare = useDesktopShareBusiness();

  // 从URL参数中获取初始模式
  useEffect(() => {
    const urlMode = searchParams.get('mode');
    const type = searchParams.get('type');
    
    if (type === 'desktop' && urlMode) {
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
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('type', 'desktop');
    currentUrl.searchParams.set('mode', newMode === 'share' ? 'send' : 'receive');
    router.replace(currentUrl.pathname + currentUrl.search);
  }, [router]);

  // 复制房间代码
  const copyCode = useCallback(async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      showToast('房间代码已复制到剪贴板', 'success');
    } catch (error) {
      console.error('复制失败:', error);
      showToast('复制失败，请手动复制', 'error');
    }
  }, [showToast]);

  // 创建房间
  const handleCreateRoom = useCallback(async () => {
    try {
      setIsLoading(true);
      console.log('[DesktopShare] 用户点击创建房间');
      
      const roomCode = await desktopShare.createRoom();
      console.log('[DesktopShare] 房间创建成功:', roomCode);
      
      showToast(`房间创建成功！代码: ${roomCode}`, 'success');
    } catch (error) {
      console.error('[DesktopShare] 创建房间失败:', error);
      const errorMessage = error instanceof Error ? error.message : '创建房间失败';
      showToast(errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [desktopShare, showToast]);

  // 开始桌面共享
  const handleStartSharing = useCallback(async () => {
    try {
      setIsLoading(true);
      console.log('[DesktopShare] 用户点击开始桌面共享');
      
      await desktopShare.startSharing();
      console.log('[DesktopShare] 桌面共享开始成功');
      
      showToast('桌面共享已开始', 'success');
    } catch (error) {
      console.error('[DesktopShare] 开始桌面共享失败:', error);
      const errorMessage = error instanceof Error ? error.message : '开始桌面共享失败';
      showToast(errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [desktopShare, showToast]);

  // 切换桌面
  const handleSwitchDesktop = useCallback(async () => {
    try {
      setIsLoading(true);
      console.log('[DesktopShare] 用户点击切换桌面');
      
      await desktopShare.switchDesktop();
      console.log('[DesktopShare] 桌面切换成功');
      
      showToast('桌面切换成功', 'success');
    } catch (error) {
      console.error('[DesktopShare] 切换桌面失败:', error);
      const errorMessage = error instanceof Error ? error.message : '切换桌面失败';
      showToast(errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [desktopShare, showToast]);

  // 停止桌面共享
  const handleStopSharing = useCallback(async () => {
    try {
      setIsLoading(true);
      console.log('[DesktopShare] 用户点击停止桌面共享');
      
      await desktopShare.stopSharing();
      console.log('[DesktopShare] 桌面共享停止成功');
      
      showToast('桌面共享已停止', 'success');
    } catch (error) {
      console.error('[DesktopShare] 停止桌面共享失败:', error);
      const errorMessage = error instanceof Error ? error.message : '停止桌面共享失败';
      showToast(errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [desktopShare, showToast]);

  // 加入观看
  const handleJoinViewing = useCallback(async () => {
    if (!inputCode.trim()) {
      showToast('请输入房间代码', 'error');
      return;
    }

    try {
      setIsLoading(true);
      console.log('[DesktopShare] 用户加入观看房间:', inputCode);
      
      await desktopShare.joinSharing(inputCode.trim().toUpperCase());
      console.log('[DesktopShare] 加入观看成功');
      
      showToast('已加入桌面共享', 'success');
    } catch (error) {
      console.error('[DesktopShare] 加入观看失败:', error);
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
      console.error('[DesktopShare] 停止观看失败:', error);
      showToast('退出失败', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [desktopShare, showToast]);

  // 连接状态指示器
  const getConnectionStatus = () => {
    if (desktopShare.isConnecting) return { icon: Wifi, text: '连接中...', color: 'text-yellow-600' };
    if (desktopShare.isPeerConnected) return { icon: Wifi, text: 'P2P已连接', color: 'text-green-600' };
    if (desktopShare.isWebSocketConnected) return { icon: Users, text: '等待对方加入', color: 'text-blue-600' };
    return { icon: WifiOff, text: '未连接', color: 'text-gray-600' };
  };

  const connectionStatus = getConnectionStatus();

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

      {mode === 'share' ? (
        /* 共享模式 */
        <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 sm:p-6 shadow-lg border border-white/20 animate-fade-in-up">
          {!desktopShare.connectionCode ? (
            // 创建房间前的界面
            <div className="space-y-6">
              {/* 功能标题和状态 */}
              <div className="flex items-center mb-6">
                <div className="flex items-center space-x-3 flex-1">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-xl flex items-center justify-center">
                    <Monitor className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-800">共享桌面</h2>
                    <p className="text-sm text-slate-600">分享您的屏幕给其他人</p>
                  </div>
                </div>
                
                {/* 竖线分割 */}
                <div className="w-px h-12 bg-slate-200 mx-4"></div>
                
                {/* 状态显示 */}
                <div className="text-right">
                  <div className="text-sm text-slate-500 mb-1">连接状态</div>
                  <div className="flex items-center justify-end space-x-3 text-sm">
                    {/* WebSocket状态 */}
                    <div className="flex items-center space-x-1">
                      <div className={`w-2 h-2 rounded-full ${desktopShare.isWebSocketConnected ? 'bg-blue-500 animate-pulse' : 'bg-slate-400'}`}></div>
                      <span className={desktopShare.isWebSocketConnected ? 'text-blue-600' : 'text-slate-600'}>WS</span>
                    </div>
                    
                    {/* 分隔符 */}
                    <div className="text-slate-300">|</div>
                    
                    {/* WebRTC状态 */}
                    <div className="flex items-center space-x-1">
                      <div className={`w-2 h-2 rounded-full ${desktopShare.isPeerConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></div>
                      <span className={desktopShare.isPeerConnected ? 'text-emerald-600' : 'text-slate-600'}>RTC</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-center py-12">
                <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-full flex items-center justify-center">
                  <Monitor className="w-10 h-10 text-purple-500" />
                </div>
                <h3 className="text-xl font-semibold text-slate-800 mb-4">创建桌面共享房间</h3>
                <p className="text-slate-600 mb-8">创建房间后将生成分享码，等待接收方加入后即可开始桌面共享</p>
                
                <Button
                  onClick={handleCreateRoom}
                  disabled={isLoading || desktopShare.isConnecting}
                  className="px-8 py-3 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white text-lg font-medium rounded-xl shadow-lg"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      创建中...
                    </>
                  ) : (
                    <>
                      <Share className="w-5 h-5 mr-2" />
                      创建桌面共享房间
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            // 房间已创建，显示取件码和等待界面
            <div className="space-y-6">
              {/* 功能标题和状态 */}
              <div className="flex items-center mb-6">
                <div className="flex items-center space-x-3 flex-1">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-xl flex items-center justify-center">
                    <Monitor className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-800">共享桌面</h2>
                    <p className="text-sm text-slate-600">
                      {desktopShare.isPeerConnected ? '✅ 接收方已连接，现在可以开始共享桌面' : 
                       desktopShare.isWebSocketConnected ? '⏳ 房间已创建，等待接收方加入建立P2P连接' : 
                       '⚠️ 等待连接'}
                    </p>
                  </div>
                </div>
                
                {/* 竖线分割 */}
                <div className="w-px h-12 bg-slate-200 mx-4"></div>
                
                {/* 状态显示 */}
                <div className="text-right">
                  <div className="text-sm text-slate-500 mb-1">连接状态</div>
                  <div className="flex items-center justify-end space-x-3 text-sm">
                    {/* WebSocket状态 */}
                    <div className="flex items-center space-x-1">
                      <div className={`w-2 h-2 rounded-full ${desktopShare.isWebSocketConnected ? 'bg-blue-500 animate-pulse' : 'bg-red-500'}`}></div>
                      <span className={desktopShare.isWebSocketConnected ? 'text-blue-600' : 'text-red-600'}>WS</span>
                    </div>
                    
                    {/* 分隔符 */}
                    <div className="text-slate-300">|</div>
                    
                    {/* WebRTC状态 */}
                    <div className="flex items-center space-x-1">
                      <div className={`w-2 h-2 rounded-full ${desktopShare.isPeerConnected ? 'bg-emerald-500 animate-pulse' : 'bg-orange-400'}`}></div>
                      <span className={desktopShare.isPeerConnected ? 'text-emerald-600' : 'text-orange-600'}>RTC</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 桌面共享控制区域 */}
              {desktopShare.canStartSharing && (
                <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-slate-200 mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-lg font-medium text-slate-800 flex items-center">
                      <Monitor className="w-5 h-5 mr-2" />
                      桌面共享控制
                    </h4>
                    {desktopShare.isSharing && (
                      <div className="flex items-center space-x-1 bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                        <span className="font-medium">共享中</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-4">
                    {!desktopShare.isSharing ? (
                      <div className="space-y-3">
                        <Button
                          onClick={handleStartSharing}
                          disabled={isLoading || !desktopShare.isPeerConnected}
                          className={`w-full px-8 py-3 text-lg font-medium rounded-xl shadow-lg ${
                            desktopShare.isPeerConnected 
                              ? 'bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white' 
                              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          }`}
                        >
                          <Play className="w-5 h-5 mr-2" />
                          {isLoading ? '启动中...' : '选择并开始共享桌面'}
                        </Button>
                        
                        {!desktopShare.isPeerConnected && (
                          <div className="text-center">
                            <p className="text-sm text-gray-500 mb-2">
                              等待接收方加入房间建立P2P连接...
                            </p>
                            <div className="flex items-center justify-center space-x-2">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500"></div>
                              <span className="text-sm text-purple-600">正在等待连接</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center justify-center space-x-2 text-green-600 mb-4">
                          <Play className="w-5 h-5" />
                          <span className="font-semibold">桌面共享进行中</span>
                        </div>
                        <div className="flex justify-center space-x-3">
                          <Button
                            onClick={handleSwitchDesktop}
                            disabled={isLoading}
                            variant="outline"
                            size="sm"
                          >
                            <Repeat className="w-4 h-4 mr-2" />
                            {isLoading ? '切换中...' : '切换桌面'}
                          </Button>
                          <Button
                            onClick={handleStopSharing}
                            disabled={isLoading}
                            variant="destructive"
                            size="sm"
                          >
                            <Square className="w-4 h-4 mr-2" />
                            {isLoading ? '停止中...' : '停止共享'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 取件码显示 - 和文件传输一致的风格 */}
              <div className="border-t border-slate-200 pt-6">
                {/* 左上角状态提示 */}
                <div className="flex items-center mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center">
                      <Monitor className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-800">房间码生成成功！</h3>
                      <p className="text-sm text-slate-600">分享以下信息给观看方</p>
                    </div>
                  </div>
                </div>

                {/* 中间区域：取件码 + 分隔线 + 二维码 */}
                <div className="flex flex-col lg:flex-row lg:items-start gap-6 lg:gap-8 mb-8">
                  {/* 左侧：取件码 */}
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700 mb-3">房间代码</label>
                    <div className="flex flex-col items-center rounded-xl border border-slate-200 p-6 h-40 justify-center bg-slate-50">
                      <div className="text-2xl font-bold font-mono bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent tracking-wider">
                        {desktopShare.connectionCode}
                      </div>
                    </div>
                    <Button
                      onClick={() => copyCode(desktopShare.connectionCode)}
                      className="w-full px-4 py-2.5 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium shadow transition-all duration-200 mt-3"
                    >
                      复制房间代码
                    </Button>
                  </div>

                  {/* 分隔线 - 大屏幕显示竖线，移动端隐藏 */}
                  <div className="hidden lg:block w-px bg-slate-200 h-64 mt-6"></div>

                  {/* 右侧：二维码 */}
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700 mb-3">扫码观看</label>
                    <div className="flex flex-col items-center rounded-xl border border-slate-200 p-6 h-40 justify-center bg-slate-50">
                      <QRCodeDisplay 
                        value={`${typeof window !== 'undefined' ? window.location.origin : ''}?type=desktop&mode=receive&code=${desktopShare.connectionCode}`}
                        size={120}
                      />
                    </div>
                    <div className="w-full px-4 py-2.5 bg-blue-500 text-white rounded-lg font-medium shadow transition-all duration-200 mt-3 text-center">
                      使用手机扫码快速观看
                    </div>
                  </div>
                </div>

                {/* 底部：观看链接 */}
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <div className="flex-1 code-display rounded-lg p-3 bg-slate-50 border border-slate-200">
                      <div className="text-sm text-slate-700 break-all font-mono leading-relaxed">
                        {`${typeof window !== 'undefined' ? window.location.origin : ''}?type=desktop&mode=receive&code=${desktopShare.connectionCode}`}
                      </div>
                    </div>
                    <Button
                      onClick={() => {
                        const link = `${window.location.origin}?type=desktop&mode=receive&code=${desktopShare.connectionCode}`;
                        navigator.clipboard.writeText(link);
                        showToast('观看链接已复制', 'success');
                      }}
                      className="px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium shadow transition-all duration-200 shrink-0"
                    >
                      复制链接
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* 观看模式 */
        <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 sm:p-6 shadow-lg border border-white/20 animate-fade-in-up">
          <div className="space-y-6">
            {!desktopShare.isViewing ? (
              // 输入房间代码界面 - 与文本消息风格一致
              <div>
                <div className="flex items-center mb-6 sm:mb-8">
                  <div className="flex items-center space-x-3 flex-1">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-xl flex items-center justify-center">
                      <Monitor className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-slate-800">输入房间代码</h2>
                      <p className="text-sm text-slate-600">请输入6位房间代码来观看桌面共享</p>
                    </div>
                  </div>
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
                <div className="flex items-center mb-6">
                  <div className="flex items-center space-x-3 flex-1">
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center">
                      <Monitor className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-800">桌面观看</h3>
                      <p className="text-sm text-slate-500">
                        <span className="text-emerald-600">✅ 已连接，正在观看桌面共享</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* 连接成功状态 */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6">
                  <h4 className="font-semibold text-emerald-800 mb-1">已连接到桌面共享房间</h4>
                  <p className="text-emerald-700">房间代码: {inputCode}</p>
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
      )}

      {/* 错误显示 */}
      {desktopShare.error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm">{desktopShare.error}</p>
        </div>
      )}

      {/* 调试信息 */}
      <div className="mt-6">
        <button
          onClick={() => setShowDebug(!showDebug)}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          {showDebug ? '隐藏' : '显示'}调试信息
        </button>
        
        {showDebug && (
          <div className="mt-2 p-3 bg-gray-50 rounded text-xs text-gray-600 space-y-1">
            <div>WebSocket连接: {desktopShare.isWebSocketConnected ? '✅' : '❌'}</div>
            <div>P2P连接: {desktopShare.isPeerConnected ? '✅' : '❌'}</div>
            <div>房间代码: {desktopShare.connectionCode || '未创建'}</div>
            <div>共享状态: {desktopShare.isSharing ? '进行中' : '未共享'}</div>
            <div>观看状态: {desktopShare.isViewing ? '观看中' : '未观看'}</div>
            <div>等待对方: {desktopShare.isWaitingForPeer ? '是' : '否'}</div>
            <div>远程流: {desktopShare.remoteStream ? '已接收' : '无'}</div>
          </div>
        )}
      </div>
    </div>
  );
}
