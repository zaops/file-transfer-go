"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageSquare, Copy, Send, Download, Image, Users } from 'lucide-react';
import { useToast } from '@/components/ui/toast-simple';

interface TextTransferProps {
  onSendText?: (text: string) => Promise<string>; // 返回取件码
  onReceiveText?: (code: string) => Promise<string>; // 返回文本内容
  websocket?: WebSocket | null;
  isConnected?: boolean;
  currentRole?: 'sender' | 'receiver';
  pickupCode?: string;
}

export default function TextTransfer({ 
  onSendText, 
  onReceiveText, 
  websocket, 
  isConnected = false,
  currentRole,
  pickupCode
}: TextTransferProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [mode, setMode] = useState<'send' | 'receive'>('send');
  const [textContent, setTextContent] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [receivedText, setReceivedText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRoomCreated, setIsRoomCreated] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState(0);
  const [images, setImages] = useState<string[]>([]);
  const { showToast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 从URL参数中获取初始模式
  useEffect(() => {
    const urlMode = searchParams.get('mode') as 'send' | 'receive';
    const type = searchParams.get('type');
    
    if (type === 'text' && urlMode && ['send', 'receive'].includes(urlMode)) {
      setMode(urlMode);
    }
  }, [searchParams]);

  // 监听WebSocket消息
  useEffect(() => {
    if (!websocket) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        console.log('TextTransfer收到消息:', message);

        switch (message.type) {
          case 'text-update':
            // 实时更新文字内容
            if (message.payload?.text !== undefined) {
              setReceivedText(message.payload.text);
              if (currentRole === 'receiver') {
                setTextContent(message.payload.text);
              }
            }
            break;
          
          case 'text-send':
            // 接收到发送的文字
            if (message.payload?.text) {
              setReceivedText(message.payload.text);
              showToast('收到新的文字内容！', 'success');
            }
            break;
          
          case 'image-send':
            // 接收到发送的图片
            if (message.payload?.imageData) {
              setImages(prev => [...prev, message.payload.imageData]);
              showToast('收到新的图片！', 'success');
            }
            break;
          
          case 'room-status':
            // 更新房间状态
            if (message.payload?.sender_count !== undefined && message.payload?.receiver_count !== undefined) {
              setConnectedUsers(message.payload.sender_count + message.payload.receiver_count);
            }
            break;
        }
      } catch (error) {
        console.error('解析WebSocket消息失败:', error);
      }
    };

    websocket.addEventListener('message', handleMessage);
    return () => websocket.removeEventListener('message', handleMessage);
  }, [websocket, currentRole, showToast]);

  // 更新URL参数
  const updateMode = useCallback((newMode: 'send' | 'receive') => {
    setMode(newMode);
    const params = new URLSearchParams(searchParams.toString());
    params.set('type', 'text');
    params.set('mode', newMode);
    router.push(`?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  // 发送实时文字更新
  const sendTextUpdate = useCallback((text: string) => {
    if (!websocket || !isConnected || !isRoomCreated) return;

    // 清除之前的定时器
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    // 设置新的定时器，防抖动
    updateTimeoutRef.current = setTimeout(() => {
      websocket.send(JSON.stringify({
        type: 'text-update',
        payload: { text }
      }));
    }, 300); // 300ms防抖
  }, [websocket, isConnected, isRoomCreated]);

  // 处理文字输入
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setTextContent(newText);
    
    // 如果是发送方且房间已创建，发送实时更新
    if (currentRole === 'sender' && isRoomCreated) {
      sendTextUpdate(newText);
    }
  }, [currentRole, isRoomCreated, sendTextUpdate]);

  // 创建文字传输房间
  const handleCreateRoom = useCallback(async () => {
    if (!textContent.trim()) {
      showToast('请输入要传输的文字内容', 'error');
      return;
    }

    setIsLoading(true);
    try {
      if (onSendText) {
        const code = await onSendText(textContent);
        setRoomCode(code);
        setIsRoomCreated(true);
        showToast('房间创建成功！', 'success');
      }
    } catch (error) {
      console.error('创建房间失败:', error);
      showToast('创建房间失败，请重试', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [textContent, onSendText, showToast]);

  // 加入房间
  const handleJoinRoom = useCallback(async () => {
    if (!roomCode.trim() || roomCode.length !== 6) {
      showToast('请输入正确的6位房间码', 'error');
      return;
    }

    setIsLoading(true);
    try {
      if (onReceiveText) {
        const text = await onReceiveText(roomCode);
        setReceivedText(text);
        showToast('成功加入房间！', 'success');
      }
    } catch (error) {
      console.error('加入房间失败:', error);
      showToast('加入房间失败，请检查房间码', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [roomCode, onReceiveText, showToast]);

  // 发送文字
  const handleSendText = useCallback(() => {
    if (!websocket || !isConnected || !textContent.trim()) return;

    websocket.send(JSON.stringify({
      type: 'text-send',
      payload: { text: textContent }
    }));
    
    showToast('文字已发送！', 'success');
  }, [websocket, isConnected, textContent, showToast]);

  // 处理图片粘贴
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const imageData = event.target?.result as string;
            setImages(prev => [...prev, imageData]);
            
            // 发送图片给其他用户
            if (websocket && isConnected) {
              websocket.send(JSON.stringify({
                type: 'image-send',
                payload: { imageData }
              }));
              showToast('图片已发送！', 'success');
            }
          };
          reader.readAsDataURL(file);
        }
      }
    }
  }, [websocket, isConnected, showToast]);

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
            接收文字
          </Button>
        </div>
      </div>

      {mode === 'send' ? (
        <div className="glass-card rounded-2xl p-4 sm:p-6 animate-fade-in-up">
          <div className="text-center mb-6">
            <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center animate-float">
              <MessageSquare className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold text-slate-800 mb-2">传送文字</h2>
            <p className="text-sm sm:text-base text-slate-600">
              {isRoomCreated ? '实时编辑，对方可以同步看到' : '输入要传输的文本内容'}
            </p>
            {connectedUsers > 1 && (
              <div className="flex items-center justify-center mt-2 text-sm text-emerald-600">
                <Users className="w-4 h-4 mr-1" />
                {connectedUsers} 人在线
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={textContent}
                onChange={handleTextChange}
                onPaste={handlePaste}
                placeholder="在这里输入要传输的文本内容...&#10;&#10;💡 提示：&#10;• 支持实时同步编辑&#10;• 可以直接粘贴图片 (Ctrl+V)"
                className="w-full min-h-[300px] p-4 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:ring-blue-500 bg-white/80 backdrop-blur-sm resize-none"
                disabled={isLoading}
              />
              {isRoomCreated && (
                <div className="absolute top-2 right-2">
                  <div className="flex items-center space-x-1 bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg text-xs">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                    <span>实时同步</span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex justify-between text-sm text-slate-500">
              <span>{textContent.length} 字符</span>
              <span>最大 50,000 字符</span>
            </div>

            {!isRoomCreated ? (
              <Button
                onClick={handleCreateRoom}
                disabled={!textContent.trim() || textContent.length > 50000 || isLoading}
                className="w-full h-12 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white text-lg font-medium rounded-xl shadow-lg"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    创建房间...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5 mr-2" />
                    创建文字传输房间
                  </>
                )}
              </Button>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-200">
                  <div className="text-center">
                    <p className="text-sm text-emerald-700 mb-2">房间码</p>
                    <div className="text-2xl font-bold font-mono text-emerald-600 mb-3">{roomCode}</div>
                    <Button
                      onClick={() => copyToClipboard(roomCode)}
                      size="sm"
                      className="bg-emerald-500 hover:bg-emerald-600 text-white mr-2"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      复制房间码
                    </Button>
                    <Button
                      onClick={handleSendText}
                      size="sm"
                      className="bg-blue-500 hover:bg-blue-600 text-white"
                      disabled={!textContent.trim()}
                    >
                      <Send className="w-4 h-4 mr-2" />
                      发送文字
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* 图片展示区域 */}
            {images.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-medium text-slate-800 mb-3 flex items-center">
                  <Image className="w-5 h-5 mr-2" />
                  已发送的图片 ({images.length})
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {images.map((img, index) => (
                    <div key={index} className="relative group">
                      <img 
                        src={img} 
                        alt={`图片 ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg border-2 border-slate-200 hover:border-blue-400 transition-colors cursor-pointer"
                        onClick={() => window.open(img, '_blank')}
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity rounded-lg"></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="glass-card rounded-2xl p-4 sm:p-6 animate-fade-in-up">
          <div className="text-center mb-6">
            <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center animate-float">
              <Download className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold text-slate-800 mb-2">接收文字</h2>
            <p className="text-sm sm:text-base text-slate-600">输入6位房间码来获取文字内容</p>
          </div>

          <div className="space-y-4">
            <Input
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="请输入房间码"
              className="text-center text-2xl sm:text-3xl tracking-[0.3em] sm:tracking-[0.5em] font-mono h-12 sm:h-16 border-2 border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-emerald-500 bg-white/80 backdrop-blur-sm"
              maxLength={6}
              disabled={isLoading}
            />

            <Button
              onClick={handleJoinRoom}
              disabled={roomCode.length !== 6 || isLoading}
              className="w-full h-12 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white text-lg font-medium rounded-xl shadow-lg"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  连接中...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5 mr-2" />
                  获取文字
                </>
              )}
            </Button>

            {(receivedText || textContent) && (
              <div className="mt-6 space-y-4">
                <div className="relative">
                  <textarea
                    value={receivedText || textContent}
                    readOnly={currentRole !== 'receiver'}
                    onChange={currentRole === 'receiver' ? handleTextChange : undefined}
                    className="w-full min-h-[300px] p-4 border-2 border-emerald-200 rounded-xl bg-emerald-50/50 backdrop-blur-sm resize-none"
                  />
                  {currentRole === 'receiver' && isConnected && (
                    <div className="absolute top-2 right-2">
                      <div className="flex items-center space-x-1 bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg text-xs">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                        <span>实时同步</span>
                      </div>
                    </div>
                  )}
                </div>
                <Button
                  onClick={() => copyToClipboard(receivedText || textContent)}
                  className="w-full h-12 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white text-lg font-medium rounded-xl shadow-lg"
                >
                  <Copy className="w-5 h-5 mr-2" />
                  复制文字
                </Button>
              </div>
            )}

            {/* 接收到的图片展示 */}
            {images.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-medium text-slate-800 mb-3 flex items-center">
                  <Image className="w-5 h-5 mr-2" />
                  接收到的图片 ({images.length})
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {images.map((img, index) => (
                    <div key={index} className="relative group">
                      <img 
                        src={img} 
                        alt={`图片 ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg border-2 border-slate-200 hover:border-emerald-400 transition-colors cursor-pointer"
                        onClick={() => window.open(img, '_blank')}
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity rounded-lg"></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
