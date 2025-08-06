"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useWebRTCTransfer } from '@/hooks/useWebRTCTransfer';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast-simple';
import { MessageSquare, Image, Send, Copy, Link, Upload, Download, X } from 'lucide-react';
import QRCodeDisplay from '@/components/QRCodeDisplay';

interface Message {
  id: string;
  type: 'text' | 'image';
  content: string;
  timestamp: Date;
  sender: 'self' | 'peer';
  fileName?: string;
}

export const WebRTCTextImageTransfer: React.FC = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { showToast } = useToast();
  
  // 状态管理
  const [mode, setMode] = useState<'send' | 'receive'>('send');
  const [pickupCode, setPickupCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [textInput, setTextInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [hasProcessedInitialUrl, setHasProcessedInitialUrl] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    text: textTransfer,
    file: fileTransfer,
    connectAll,
    disconnectAll,
    hasAnyConnection,
    isAnyConnecting,
    hasAnyError
  } = useWebRTCTransfer();

  // 加入房间 - 提前定义以供 useEffect 使用
  const joinRoom = useCallback(async (code: string) => {
    const trimmedCode = code.trim().toUpperCase();
    
    if (!trimmedCode || trimmedCode.length !== 6) {
      showToast('请输入正确的6位取件码', "error");
      return;
    }

    // 检查是否已经在连接或已经连接
    if (isAnyConnecting) {
      console.log('已经在连接中，跳过重复请求');
      return;
    }

    if (hasAnyConnection) {
      console.log('已经连接，跳过重复请求');
      return;
    }

    try {
      setPickupCode(trimmedCode);
      
      await connectAll(trimmedCode, 'receiver');
      
      showToast(`成功加入消息房间: ${trimmedCode}`, "success");
    } catch (error) {
      console.error('加入房间失败:', error);
      showToast(error instanceof Error ? error.message : '加入房间失败', "error");
    }
  }, [isAnyConnecting, hasAnyConnection, connectAll]);

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
      
      if (code && urlMode === 'receive') {
        setInputCode(code);
        // 延迟执行连接，避免重复调用
        const timeoutId = setTimeout(() => {
          // 检查是否已经连接或正在连接
          if (!hasAnyConnection && !isAnyConnecting) {
            joinRoom(code);
          }
        }, 100);
        
        return () => clearTimeout(timeoutId);
      }
    }
  }, [searchParams, hasProcessedInitialUrl, hasAnyConnection, isAnyConnecting, joinRoom]);

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

  // 监听文本消息
  useEffect(() => {
    const cleanup = textTransfer.onMessageReceived((message) => {
      setMessages(prev => [...prev, {
        id: message.id,
        type: 'text',
        content: message.text,
        timestamp: new Date(message.timestamp),
        sender: 'peer'
      }]);
      
      // 移除不必要的Toast提示 - 消息在聊天界面中已经显示了
    });

    return cleanup;
  }, [textTransfer.onMessageReceived]);

  // 监听打字状态
  useEffect(() => {
    const cleanup = textTransfer.onTypingStatus((typing) => {
      setIsTyping(typing);
    });

    return cleanup;
  }, [textTransfer.onTypingStatus]);

  // 监听文件（图片）接收
  useEffect(() => {
    const cleanup = fileTransfer.onFileReceived((fileData) => {
      if (fileData.file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const imageData = e.target?.result as string;
          setMessages(prev => [...prev, {
            id: fileData.id,
            type: 'image',
            content: imageData,
            timestamp: new Date(),
            sender: 'peer',
            fileName: fileData.file.name
          }]);
          
          // 移除不必要的Toast提示 - 图片在聊天界面中已经显示了
        };
        reader.readAsDataURL(fileData.file);
      }
    });

    return cleanup;
  }, [fileTransfer.onFileReceived]);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 创建空房间
  const createRoom = async () => {
    try {
      const response = await fetch('/api/create-room', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'message',
          initialText: textInput.trim() || '', 
          hasImages: false,
          maxFileSize: 5 * 1024 * 1024,
          settings: {
            enableRealTimeText: true,
            enableImageTransfer: true
          }
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '创建房间失败');
      }

      const code = data.code;
      setPickupCode(code);
      
      await connectAll(code, 'sender');
      
      // 如果有初始文本，发送它
      if (textInput.trim()) {
        setTimeout(() => {
          sendTextMessage();
        }, 1000);
      }
      
      showToast(`消息房间创建成功！取件码: ${code}`, "success");
    } catch (error) {
      console.error('创建房间失败:', error);
      showToast(error instanceof Error ? error.message : '创建房间失败', "error");
    }
  };

  // 发送文本消息
  const sendTextMessage = () => {
    if (!textInput.trim() || !textTransfer.isConnected) return;
    
    const message = {
      id: `msg_${Date.now()}`,
      type: 'text' as const,
      content: textInput.trim(),
      timestamp: new Date(),
      sender: 'self' as const
    };
    
    setMessages(prev => [...prev, message]);
    textTransfer.sendMessage(textInput.trim());
    setTextInput('');
    
    // 重置自动调整高度
    if (textareaRef.current) {
      textareaRef.current.style.height = '40px';
    }
  };

  // 处理文本输入变化（实时同步）
  const handleTextInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setTextInput(value);
    
    // 自动调整高度
    const textarea = e.target;
    textarea.style.height = '40px';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    
    // 发送实时文字（如果已连接）
    if (textTransfer.isConnected) {
      // 发送打字状态
      textTransfer.sendTypingStatus(value.length > 0);
      
      // 清除之前的定时器
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // 设置新的定时器来停止打字状态
      if (value.length > 0) {
        typingTimeoutRef.current = setTimeout(() => {
          textTransfer.sendTypingStatus(false);
        }, 2000);
      }
    }
  };

  // 处理图片选择
  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      showToast('请选择图片文件', "error");
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      showToast('图片文件大小不能超过5MB', "error");
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const imageData = e.target?.result as string;
      const message = {
        id: `img_${Date.now()}`,
        type: 'image' as const,
        content: imageData,
        timestamp: new Date(),
        sender: 'self' as const,
        fileName: file.name
      };
      
      setMessages(prev => [...prev, message]);
      
      if (fileTransfer.isConnected) {
        fileTransfer.sendFile(file);
        // 移除发送图片的Toast提示 - 图片在聊天界面中已经显示了
      }
    };
    reader.readAsDataURL(file);
    
    event.target.value = '';
  };

  // 复制分享链接
  const copyShareLink = () => {
    const baseUrl = window.location.origin + window.location.pathname;
    const shareLink = `${baseUrl}?type=message&mode=receive&code=${pickupCode}`;
    
    navigator.clipboard.writeText(shareLink).then(() => {
      showToast('分享链接已复制', "success");
    }).catch(() => {
      showToast('复制失败，请手动复制', "error");
    });
  };

  // 复制取件码
  const copyCode = () => {
    navigator.clipboard.writeText(pickupCode);
    showToast("取件码已复制", "success");
  };

  // 重新开始
  const restart = () => {
    setPickupCode('');
    setInputCode('');
    setMessages([]);
    setTextInput('');
    setIsTyping(false);
    setPreviewImage(null);
    disconnectAll();
    
    const params = new URLSearchParams(searchParams.toString());
    params.set('type', 'message');
    params.set('mode', mode);
    params.delete('code');
    router.push(`?${params.toString()}`, { scroll: false });
  };

  const pickupLink = pickupCode ? `${typeof window !== 'undefined' ? window.location.origin : ''}?type=message&mode=receive&code=${pickupCode}` : '';

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
            <MessageSquare className="w-4 h-4 mr-2" />
            发送消息
          </Button>
          <Button
            variant={mode === 'receive' ? 'default' : 'ghost'}
            onClick={() => updateMode('receive')}
            className="px-6 py-2 rounded-lg"
          >
            <Download className="w-4 h-4 mr-2" />
            接收消息
          </Button>
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 sm:p-6 shadow-lg border border-white/20 animate-fade-in-up">
        {mode === 'send' ? (
          <div className="space-y-6">
            {!pickupCode ? (
              // 创建房间前的界面 - 和文件传输完全一致的结构
              <div className="space-y-6">
                {/* 功能标题和状态 */}
                <div className="flex items-center">
                  <div className="flex items-center space-x-3 flex-1">
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-500 rounded-xl flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-slate-800">文本消息</h2>
                      <p className="text-sm text-slate-600">输入消息内容，支持文字和图片传输</p>
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
                        <div className={`w-2 h-2 rounded-full ${textTransfer.isWebSocketConnected ? 'bg-green-500' : 'bg-slate-400'}`}></div>
                        <span className="text-slate-600">WS</span>
                      </div>
                      
                      {/* 分隔符 */}
                      <div className="text-slate-300">|</div>
                      
                      {/* WebRTC状态 */}
                      <div className="flex items-center space-x-1">
                        <div className={`w-2 h-2 rounded-full ${textTransfer.isConnected ? 'bg-green-500' : 'bg-slate-400'}`}></div>
                        <span className="text-slate-600">RTC</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 消息输入区域 */}
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        消息内容
                      </label>
                      <textarea
                        ref={textareaRef}
                        value={textInput}
                        onChange={handleTextInputChange}
                        placeholder="输入要发送的消息..."
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                        rows={4}
                        style={{ minHeight: '100px', maxHeight: '200px' }}
                      />
                      <div className="mt-2 text-xs text-slate-500">
                        {textInput.length}/50000 字符 • 支持实时同步
                      </div>
                    </div>

                    {/* 图片上传按钮 */}
                    <div className="flex items-center space-x-2">
                      <Button
                        onClick={() => fileInputRef.current?.click()}
                        variant="outline"
                        size="sm"
                        className="flex items-center space-x-1"
                      >
                        <Image className="w-4 h-4" />
                        <span>添加图片</span>
                      </Button>
                      <span className="text-xs text-slate-500">支持 JPG, PNG, GIF 格式，最大 5MB</span>
                    </div>
                  </div>
                </div>

                {/* 创建房间按钮 */}
                <div className="flex justify-center">
                  <Button
                    onClick={createRoom}
                    disabled={isAnyConnecting}
                    className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-lg"
                  >
                    {isAnyConnecting ? '创建中...' : '创建消息房间'}
                  </Button>
                </div>
              </div>
            ) : (
              // 房间已创建，显示取件码和聊天界面
              <div className="space-y-6">
                {/* 取件码显示 */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-emerald-800 mb-4">消息房间已创建</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div>
                        <div className="text-sm text-emerald-700 mb-2">取件码</div>
                        <div className="flex items-center space-x-2">
                          <span className="text-3xl font-mono font-bold text-emerald-800 bg-white px-4 py-2 rounded-lg">
                            {pickupCode}
                          </span>
                          <Button onClick={copyCode} size="sm" variant="outline">
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <Button onClick={copyShareLink} className="w-full" size="sm">
                        <Link className="w-4 h-4 mr-2" />
                        复制分享链接
                      </Button>
                    </div>
                    
                    <div className="flex items-center justify-center">
                      <QRCodeDisplay value={pickupLink} size={120} />
                    </div>
                  </div>
                </div>

                {/* 连接状态 */}
                {hasAnyConnection ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-blue-700 text-sm">✅ 已连接，开始实时聊天</p>
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="text-center">
                      <p className="text-amber-700 mb-2">等待对方连接...</p>
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-600 mx-auto"></div>
                    </div>
                  </div>
                )}

                {/* 聊天界面 */}
                {hasAnyConnection && (
                  <div className="space-y-4">
                    {/* 消息历史 */}
                    <div className="bg-slate-50 rounded-lg p-4 max-h-80 overflow-y-auto">
                      {messages.length === 0 ? (
                        <p className="text-slate-500 text-center">开始发送消息吧！</p>
                      ) : (
                        <div className="space-y-3">
                          {messages.map((message) => (
                            <div key={message.id} className={`flex ${message.sender === 'self' ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-xs ${message.sender === 'self' ? 'bg-emerald-500 text-white' : 'bg-white'} rounded-lg p-3 shadow`}>
                                {message.type === 'text' ? (
                                  <p className="break-words">{message.content}</p>
                                ) : (
                                  <div>
                                    <img
                                      src={message.content}
                                      alt={message.fileName}
                                      className="max-w-full h-auto rounded cursor-pointer"
                                      onClick={() => setPreviewImage(message.content)}
                                    />
                                    <p className="text-xs mt-1 opacity-75">{message.fileName}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                          
                          {/* 打字状态指示器 */}
                          {isTyping && (
                            <div className="flex justify-start">
                              <div className="bg-gray-200 rounded-lg p-3">
                                <p className="text-gray-600 text-sm">对方正在输入...</p>
                              </div>
                            </div>
                          )}
                          <div ref={messagesEndRef} />
                        </div>
                      )}
                    </div>

                    {/* 消息输入区域 */}
                    <div className="flex space-x-2">
                      <Button
                        onClick={() => fileInputRef.current?.click()}
                        variant="outline"
                        size="sm"
                      >
                        <Image className="w-4 h-4" />
                      </Button>
                      <textarea
                        ref={textareaRef}
                        value={textInput}
                        onChange={handleTextInputChange}
                        placeholder="输入消息..."
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                        rows={1}
                        style={{ minHeight: '40px', maxHeight: '120px' }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendTextMessage();
                          }
                        }}
                      />
                      <Button onClick={sendTextMessage} disabled={!textInput.trim()} className="bg-emerald-500 hover:bg-emerald-600">
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          // 接收模式
          <div className="space-y-6">
            <div className="flex items-center">
              <div className="flex items-center space-x-3 flex-1">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center">
                  <Download className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">接收消息</h2>
                  <p className="text-sm text-slate-600">输入取件码或通过分享链接加入房间</p>
                </div>
              </div>
              
              {/* 竖线分割 */}
              <div className="w-px h-12 bg-slate-200 mx-4"></div>
              
              {/* 状态显示 */}
              <div className="text-right">
                <div className="text-sm text-slate-500 mb-1">连接状态</div>
                <div className="flex items-center justify-end space-x-3 text-sm">
                  <div className="flex items-center space-x-1">
                    <div className={`w-2 h-2 rounded-full ${textTransfer.isWebSocketConnected ? 'bg-green-500' : 'bg-slate-400'}`}></div>
                    <span className="text-slate-600">WS</span>
                  </div>
                  <div className="text-slate-300">|</div>
                  <div className="flex items-center space-x-1">
                    <div className={`w-2 h-2 rounded-full ${textTransfer.isConnected ? 'bg-green-500' : 'bg-slate-400'}`}></div>
                    <span className="text-slate-600">RTC</span>
                  </div>
                </div>
              </div>
            </div>

            {!hasAnyConnection ? (
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    输入6位取件码
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={inputCode}
                      onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                      placeholder="取件码"
                      maxLength={6}
                      className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-lg text-center"
                    />
                    <Button
                      onClick={() => joinRoom(inputCode)}
                      disabled={!inputCode.trim() || isAnyConnecting}
                      className="px-6"
                    >
                      {isAnyConnecting ? '连接中...' : '加入'}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              // 已连接，显示消息界面
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-800 mb-1">已连接到消息房间</h4>
                  <p className="text-blue-700">取件码: {pickupCode}</p>
                </div>

                <div className="bg-slate-50 rounded-lg p-4 max-h-80 overflow-y-auto">
                  {messages.length === 0 ? (
                    <p className="text-slate-500 text-center">等待接收消息...</p>
                  ) : (
                    <div className="space-y-3">
                      {messages.map((message) => (
                        <div key={message.id} className={`flex ${message.sender === 'self' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-xs ${message.sender === 'self' ? 'bg-blue-500 text-white' : 'bg-white'} rounded-lg p-3 shadow`}>
                            {message.type === 'text' ? (
                              <p className="break-words">{message.content}</p>
                            ) : (
                              <div>
                                <img
                                  src={message.content}
                                  alt={message.fileName}
                                  className="max-w-full h-auto rounded cursor-pointer"
                                  onClick={() => setPreviewImage(message.content)}
                                />
                                <p className="text-xs mt-1 opacity-75">{message.fileName}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      
                      {isTyping && (
                        <div className="flex justify-start">
                          <div className="bg-gray-200 rounded-lg p-3">
                            <p className="text-gray-600 text-sm">对方正在输入...</p>
                          </div>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </div>

                {/* 接收方也可以发送消息 */}
                <div className="flex space-x-2">
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    variant="outline"
                    size="sm"
                  >
                    <Image className="w-4 h-4" />
                  </Button>
                  <textarea
                    ref={textareaRef}
                    value={textInput}
                    onChange={handleTextInputChange}
                    placeholder="回复消息..."
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={1}
                    style={{ minHeight: '40px', maxHeight: '120px' }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendTextMessage();
                      }
                    }}
                  />
                  <Button onClick={sendTextMessage} disabled={!textInput.trim()}>
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageSelect}
        className="hidden"
      />

      {/* 图片预览模态框 */}
      {previewImage && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-4xl max-h-4xl">
            <img src={previewImage} alt="预览" className="max-w-full max-h-full" />
            <Button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 bg-white text-black hover:bg-gray-200"
              size="sm"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* 错误状态和重新开始按钮 */}
      {hasAnyError && (
        <div className="text-center">
          <Button onClick={restart} variant="outline">
            重新开始
          </Button>
        </div>
      )}
    </div>
  );
};
