"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageSquare, Copy, Send, Download, Image, Users, Link, Eye } from 'lucide-react';
import { useToast } from '@/components/ui/toast-simple';

interface TextTransferProps {
  onSendText?: (text: string) => Promise<string>; // 返回取件码
  onReceiveText?: (code: string) => Promise<string>; // 返回文本内容
  websocket?: WebSocket | null;
  isConnected?: boolean;
  currentRole?: 'sender' | 'receiver';
  pickupCode?: string;
  onCreateWebSocket?: (code: string, role: 'sender' | 'receiver') => void; // 创建WebSocket连接
}

export default function TextTransfer({ 
  onSendText, 
  onReceiveText, 
  websocket, 
  isConnected = false,
  currentRole,
  pickupCode,
  onCreateWebSocket
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
  const [sentImages, setSentImages] = useState<string[]>([]); // 发送的图片
  const [receivedImages, setReceivedImages] = useState<string[]>([]); // 接收的图片
  const [imagePreview, setImagePreview] = useState<string | null>(null); // 图片预览状态
  const [previewImage, setPreviewImage] = useState<string | null>(null); // 图片预览弹窗状态
  const [hasShownJoinSuccess, setHasShownJoinSuccess] = useState(false); // 防止重复显示加入成功消息
  const { showToast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null); // 连接超时定时器

  // 从URL参数中获取初始模式
  useEffect(() => {
    const urlMode = searchParams.get('mode') as 'send' | 'receive';
    const type = searchParams.get('type');
    
    if (type === 'text' && urlMode && ['send', 'receive'].includes(urlMode)) {
      setMode(urlMode);
      
      // 如果是接收模式且URL中有房间码，只填入房间码，不自动连接
      const urlCode = searchParams.get('code');
      if (urlMode === 'receive' && urlCode && urlCode.length === 6) {
        setRoomCode(urlCode.toUpperCase());
      }
    }
  }, [searchParams]);

  // 监听WebSocket消息和连接事件
  useEffect(() => {
    const handleWebSocketMessage = (event: CustomEvent) => {
      const message = event.detail;
      console.log('TextTransfer收到WebSocket消息:', message);

      switch (message.type) {
        case 'text-content':
          // 接收到文字房间的初始内容或同步内容
          if (message.payload?.text !== undefined) {
            setReceivedText(message.payload.text);
            if (currentRole === 'receiver') {
              setTextContent(message.payload.text);
              // 只在第一次收到文字内容且处于loading状态时显示成功消息
              if (!hasShownJoinSuccess && isLoading) {
                setHasShownJoinSuccess(true);
                showToast('成功加入文字房间！', 'success');
              }
            }
            // 清除连接超时定时器
            if (connectionTimeoutRef.current) {
              clearTimeout(connectionTimeoutRef.current);
              connectionTimeoutRef.current = null;
            }
            // 结束loading状态
            if (isLoading) {
              setIsLoading(false);
            }
          }
          break;

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
            console.log('接收到图片数据:', message.payload.imageData.substring(0, 100) + '...');
            // 验证图片数据格式
            if (message.payload.imageData.startsWith('data:image/')) {
              setReceivedImages(prev => [...prev, message.payload.imageData]);
              showToast('收到新的图片！', 'success');
            } else {
              console.error('无效的图片数据格式:', message.payload.imageData.substring(0, 50));
              showToast('收到的图片格式不正确', 'error');
            }
          }
          break;
        
        case 'room-status':
          // 更新房间状态
          if (message.payload?.sender_count !== undefined && message.payload?.receiver_count !== undefined) {
            setConnectedUsers(message.payload.sender_count + message.payload.receiver_count);
          }
          break;
      }
    };

    const handleWebSocketClose = (event: CustomEvent) => {
      const { code, reason } = event.detail;
      console.log('WebSocket连接关闭:', code, reason);
      
      // 如果是在loading状态下连接关闭，说明连接失败
      if (isLoading) {
        setIsLoading(false);
        if (code !== 1000) { // 不是正常关闭
          showToast('取件码不存在或已过期', 'error');
        }
      }
    };

    const handleWebSocketError = (event: CustomEvent) => {
      console.error('WebSocket连接错误:', event.detail);
      
      // 如果是在loading状态下出现错误，结束loading并显示错误
      if (isLoading) {
        setIsLoading(false);
        showToast('取件码不存在或已过期', 'error');
      }
    };

    window.addEventListener('websocket-message', handleWebSocketMessage as EventListener);
    window.addEventListener('websocket-close', handleWebSocketClose as EventListener);
    window.addEventListener('websocket-error', handleWebSocketError as EventListener);
    
    return () => {
      window.removeEventListener('websocket-message', handleWebSocketMessage as EventListener);
      window.removeEventListener('websocket-close', handleWebSocketClose as EventListener);
      window.removeEventListener('websocket-error', handleWebSocketError as EventListener);
      
      // 清理定时器
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
    };
  }, [currentRole, showToast, hasShownJoinSuccess, isLoading]);

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
    if (!websocket || !isConnected) return;

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
  }, [websocket, isConnected]);

  // 处理文字输入
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setTextContent(newText);
    
    // 如果有WebSocket连接，发送实时更新
    if (isConnected && websocket) {
      sendTextUpdate(newText);
    }
  }, [isConnected, websocket, sendTextUpdate]);

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
        if (code) { // 只有在成功创建房间时才设置状态和显示成功消息
          setRoomCode(code);
          setIsRoomCreated(true);
          showToast('房间创建成功！', 'success');
          
          // 创建WebSocket连接用于实时同步
          if (onCreateWebSocket) {
            onCreateWebSocket(code, 'sender');
          }
        }
      }
    } catch (error) {
      console.error('创建房间失败:', error);
      // 错误信息已经在HomePage中处理了，这里不再重复显示
    } finally {
      setIsLoading(false);
    }
  }, [textContent, onSendText, onCreateWebSocket, showToast]);

  // 加入房间
  const handleJoinRoom = useCallback(async () => {
    if (!roomCode.trim() || roomCode.length !== 6) {
      showToast('请输入正确的6位房间码', 'error');
      return;
    }

    // 防止重复加入
    if (isLoading) {
      return;
    }

    setIsLoading(true);
    setHasShownJoinSuccess(false); // 重置加入成功消息标志
    
    try {
      // 先查询房间信息，确认房间存在
      const roomInfoResponse = await fetch(`/api/room-info?code=${roomCode}`);
      const roomData = await roomInfoResponse.json();
      
      if (!roomInfoResponse.ok || !roomData.success) {
        showToast(roomData.message || '房间不存在或已过期', 'error');
        setIsLoading(false);
        return;
      }

      // 房间存在，创建WebSocket连接
      if (onCreateWebSocket) {
        console.log('房间验证成功，手动加入房间:', roomCode);
        onCreateWebSocket(roomCode, 'receiver');
        
        // 设置连接超时，如果8秒内没有收到消息就认为连接失败
        connectionTimeoutRef.current = setTimeout(() => {
          if (isLoading) {
            setIsLoading(false);
            showToast('取件码不存在或已过期', 'error');
          }
        }, 8000);
      }
    } catch (error) {
      console.error('加入房间失败:', error);
      showToast('网络错误，请稍后重试', 'error');
      setIsLoading(false);
    }
  }, [roomCode, onCreateWebSocket, showToast, isLoading]);

  // 发送文字
  const handleSendText = useCallback(() => {
    if (!websocket || !isConnected || !textContent.trim()) return;

    websocket.send(JSON.stringify({
      type: 'text-send',
      payload: { text: textContent }
    }));
    
    showToast('文字已发送！', 'success');
  }, [websocket, isConnected, textContent, showToast]);

  // 压缩图片
  const compressImage = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = document.createElement('img');
      
      if (!ctx) {
        reject(new Error('无法创建Canvas上下文'));
        return;
      }
      
      img.onload = () => {
        try {
          // 设置最大尺寸
          const maxWidth = 800;
          const maxHeight = 600;
          let { width, height } = img;
          
          // 计算压缩比例
          if (width > height) {
            if (width > maxWidth) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = (width * maxHeight) / height;
              height = maxHeight;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          // 设置白色背景，防止透明图片变成黑色
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          
          // 绘制压缩后的图片
          ctx.drawImage(img, 0, 0, width, height);
          
          // 转为base64，质量为0.8
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
          console.log('图片压缩完成，数据长度:', compressedDataUrl.length, '前100字符:', compressedDataUrl.substring(0, 100));
          resolve(compressedDataUrl);
        } catch (error) {
          reject(new Error('图片压缩失败: ' + error));
        }
      };
      
      img.onerror = () => reject(new Error('图片加载失败'));
      
      // 读取文件
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          img.src = e.target.result as string;
        } else {
          reject(new Error('文件读取失败'));
        }
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsDataURL(file);
    });
  }, []);

  // 处理图片粘贴
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) {
          try {
            showToast('正在处理图片...', 'info');
            const compressedImageData = await compressImage(file);
            setSentImages(prev => [...prev, compressedImageData]);
            
            // 发送图片给其他用户
            if (websocket && isConnected) {
              websocket.send(JSON.stringify({
                type: 'image-send',
                payload: { imageData: compressedImageData }
              }));
              showToast('图片已发送！', 'success');
            }
          } catch (error) {
            console.error('图片处理失败:', error);
            showToast('图片处理失败，请重试', 'error');
          }
        }
      }
    }
  }, [websocket, isConnected, showToast, compressImage]);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast('已复制到剪贴板！', 'success');
    } catch (err) {
      showToast('复制失败', 'error');
    }
  }, [showToast]);

  // 复制传输链接
  const copyTransferLink = useCallback(async (code: string) => {
    const currentUrl = window.location.origin + window.location.pathname;
    const transferLink = `${currentUrl}?type=text&mode=receive&code=${code}`;
    await copyToClipboard(transferLink);
  }, [copyToClipboard]);

  // 下载图片
  const downloadImage = useCallback((imageData: string, index: number) => {
    const link = document.createElement('a');
    link.download = `image_${index + 1}.jpg`;
    link.href = imageData;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('图片已下载！', 'success');
  }, [showToast]);

  // 图片预览组件
  const ImagePreviewModal = ({ src, onClose }: { src: string; onClose: () => void }) => (
    <div 
      className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={onClose}
    >
      <div className="relative max-w-[90vw] max-h-[90vh] animate-scale-in">
        <div className="relative bg-white rounded-2xl overflow-hidden shadow-2xl">
          <img 
            src={src} 
            alt="预览" 
            className="max-w-full max-h-[80vh] object-contain block bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50"
            onClick={(e) => e.stopPropagation()}
            onError={(e) => {
              console.error('预览图片加载失败:', src);
            }}
          />
          
          {/* 操作按钮栏 */}
          <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-slate-900/60 to-transparent p-4">
            <div className="flex justify-between items-center">
              <h3 className="text-white font-medium text-lg">图片预览</h3>
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    // 尝试在发送和接收的图片中查找
                    let index = sentImages.indexOf(src);
                    if (index === -1) {
                      index = receivedImages.indexOf(src);
                    }
                    downloadImage(src, index >= 0 ? index : 0);
                  }}
                  className="bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white p-2 rounded-lg shadow-lg transition-all hover:scale-105"
                  title="下载图片"
                >
                  <Download className="w-5 h-5" />
                </button>
                <button
                  onClick={onClose}
                  className="bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white p-2 rounded-lg shadow-lg transition-all hover:scale-105"
                  title="关闭预览"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          
          {/* 底部信息栏 */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900/60 to-transparent p-4">
            <div className="text-white text-sm opacity-80">
              点击空白区域关闭预览
            </div>
          </div>
        </div>
      </div>
    </div>
  );

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
            {/* 连接状态显示 */}
            <div className="mt-2 space-y-1">
              {isRoomCreated && (
                <div className="flex items-center justify-center space-x-4 text-sm">
                  <div className="flex items-center">
                    <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
                    <span className={isConnected ? 'text-emerald-600' : 'text-red-600'}>
                      {isConnected ? '实时连接已建立' : '连接断开'}
                    </span>
                  </div>
                  {connectedUsers > 0 && (
                    <div className="flex items-center text-blue-600">
                      <Users className="w-4 h-4 mr-1" />
                      {connectedUsers} 人在线
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={textContent}
                onChange={handleTextChange}
                onPaste={handlePaste}
                placeholder="在这里输入要传输的文本内容...&#10;&#10;💡 提示：支持实时同步编辑，可以直接粘贴图片 (Ctrl+V)"
                className="w-full min-h-[150px] p-4 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:ring-blue-500 bg-white/80 backdrop-blur-sm resize-none"
                disabled={isLoading}
              />
              {isRoomCreated && isConnected && (
                <div className="absolute top-2 right-2">
                  <div className="flex items-center space-x-1 bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg text-xs">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                    <span>实时同步</span>
                  </div>
                </div>
              )}
              {isRoomCreated && !isConnected && (
                <div className="absolute top-2 right-2">
                  <div className="flex items-center space-x-1 bg-orange-100 text-orange-700 px-2 py-1 rounded-lg text-xs">
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                    <span>连接中...</span>
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
                    <div className="flex flex-wrap gap-2 justify-center">
                      <Button
                        onClick={() => copyToClipboard(roomCode)}
                        size="sm"
                        className="bg-emerald-500 hover:bg-emerald-600 text-white"
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        复制房间码
                      </Button>
                      <Button
                        onClick={() => copyTransferLink(roomCode)}
                        size="sm"
                        className="bg-purple-500 hover:bg-purple-600 text-white"
                      >
                        <Link className="w-4 h-4 mr-2" />
                        复制链接
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
              </div>
            )}

            {/* 发送方显示已发送的图片 */}
            {mode === 'send' && sentImages.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-medium text-slate-800 mb-3 flex items-center">
                  <Image className="w-5 h-5 mr-2" />
                  已发送的图片 ({sentImages.length})
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {sentImages.map((img, index) => (
                    <div key={index} className="relative group overflow-hidden">
                      <img 
                        src={img} 
                        alt={`图片 ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg border-2 border-slate-200 hover:border-blue-400 transition-all duration-200 cursor-pointer bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50"
                        onClick={() => setPreviewImage(img)}
                        onError={(e) => {
                          console.error('图片加载失败:', img);
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity rounded-lg"></div>
                      
                      {/* 悬浮按钮组 */}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewImage(img);
                          }}
                          className="p-1.5 bg-white bg-opacity-90 hover:bg-opacity-100 rounded-md shadow-sm transition-all hover:scale-105"
                          title="预览图片"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-600" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadImage(img, index);
                          }}
                          className="p-1.5 bg-white bg-opacity-90 hover:bg-opacity-100 rounded-md shadow-sm transition-all hover:scale-105"
                          title="下载图片"
                        >
                          <Download className="w-3.5 h-3.5 text-slate-600" />
                        </button>
                      </div>
                      
                      {/* 图片序号 */}
                      <div className="absolute bottom-1 left-1 bg-black bg-opacity-50 text-white text-xs px-1.5 py-0.5 rounded">
                        {index + 1}
                      </div>
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
            <h2 className="text-xl sm:text-2xl font-semibold text-slate-800 mb-2">加入房间</h2>
            <p className="text-sm sm:text-base text-slate-600">输入6位房间码来获取文字内容</p>
            
            {/* 连接状态显示 */}
            {(receivedText || textContent) && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-center space-x-4 text-sm">
                  <div className="flex items-center">
                    <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
                    <span className={isConnected ? 'text-emerald-600' : 'text-red-600'}>
                      {isConnected ? '实时连接已建立' : '连接断开'}
                    </span>
                  </div>
                  {connectedUsers > 0 && (
                    <div className="flex items-center text-blue-600">
                      <Users className="w-4 h-4 mr-1" />
                      {connectedUsers} 人在线
                    </div>
                  )}
                </div>
              </div>
            )}
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
                  加入房间
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
                    className="w-full min-h-[150px] p-4 border-2 border-emerald-200 rounded-xl bg-emerald-50/50 backdrop-blur-sm resize-none"
                  />
                  {currentRole === 'receiver' && isConnected && (
                    <div className="absolute top-2 right-2">
                      <div className="flex items-center space-x-1 bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg text-xs">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                        <span>实时同步</span>
                      </div>
                    </div>
                  )}
                  {currentRole === 'receiver' && !isConnected && (
                    <div className="absolute top-2 right-2">
                      <div className="flex items-center space-x-1 bg-orange-100 text-orange-700 px-2 py-1 rounded-lg text-xs">
                        <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                        <span>连接中...</span>
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

            {/* 接收方显示接收到的图片 */}
            {mode === 'receive' && receivedImages.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-medium text-slate-800 mb-3 flex items-center">
                  <Image className="w-5 h-5 mr-2" />
                  接收到的图片 ({receivedImages.length})
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {receivedImages.map((img, index) => (
                    <div key={index} className="relative group overflow-hidden">
                      <img 
                        src={img} 
                        alt={`图片 ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg border-2 border-slate-200 hover:border-emerald-400 transition-all duration-200 cursor-pointer bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50"
                        onClick={() => setPreviewImage(img)}
                        onLoad={(e) => {
                          console.log(`图片 ${index + 1} 加载成功`);
                        }}
                        onError={(e) => {
                          console.error(`图片 ${index + 1} 加载失败:`, img.substring(0, 100));
                          e.currentTarget.style.backgroundColor = '#f1f5f9';
                          e.currentTarget.style.display = 'flex';
                          e.currentTarget.style.alignItems = 'center';
                          e.currentTarget.style.justifyContent = 'center';
                          e.currentTarget.innerHTML = `<span style="color: #64748b; font-size: 12px;">图片加载失败</span>`;
                        }}
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity rounded-lg"></div>
                      
                      {/* 悬浮按钮组 */}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewImage(img);
                          }}
                          className="p-1.5 bg-white bg-opacity-90 hover:bg-opacity-100 rounded-md shadow-sm transition-all hover:scale-105"
                          title="预览图片"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-600" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadImage(img, index);
                          }}
                          className="p-1.5 bg-white bg-opacity-90 hover:bg-opacity-100 rounded-md shadow-sm transition-all hover:scale-105"
                          title="下载图片"
                        >
                          <Download className="w-3.5 h-3.5 text-slate-600" />
                        </button>
                      </div>
                      
                      {/* 图片序号 */}
                      <div className="absolute bottom-1 left-1 bg-black bg-opacity-50 text-white text-xs px-1.5 py-0.5 rounded">
                        {index + 1}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* 图片预览弹窗 */}
      {previewImage && (
        <ImagePreviewModal 
          src={previewImage}
          onClose={() => setPreviewImage(null)}
        />
      )}
    </div>
  );
}
