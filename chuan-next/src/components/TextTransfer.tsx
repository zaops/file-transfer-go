  "use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageSquare, Copy, Send, Download, Image, Users, Link, Eye } from 'lucide-react';
import { useToast } from '@/components/ui/toast-simple';
import QRCodeDisplay from './QRCodeDisplay';

interface TextTransferProps {
  onSendText?: (text: string) => Promise<string>; // 返回取件码
  onReceiveText?: (code: string) => Promise<string>; // 返回文本内容
  websocket?: WebSocket | null;
  isConnected?: boolean; // WebRTC数据通道连接状态
  isWebSocketConnected?: boolean; // WebSocket信令连接状态
  currentRole?: 'sender' | 'receiver';
  pickupCode?: string;
  onCreateWebSocket?: (code: string, role: 'sender' | 'receiver') => void; // 创建WebSocket连接
}

export default function TextTransfer({ 
  onSendText, 
  onReceiveText, 
  websocket, 
  isConnected = false, // WebRTC数据通道连接状态
  isWebSocketConnected = false, // WebSocket信令连接状态
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
  const [currentWebSocketConnected, setCurrentWebSocketConnected] = useState(false); // 本地WebSocket连接状态
  const [previewImage, setPreviewImage] = useState<string | null>(null); // 图片预览弹窗状态
  const [hasShownJoinSuccess, setHasShownJoinSuccess] = useState(false); // 防止重复显示加入成功消息
  const [lastToastMessage, setLastToastMessage] = useState<string>(''); // 防止重复Toast
  const [lastToastTime, setLastToastTime] = useState<number>(0); // 上次Toast时间
  const { showToast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null); // 连接超时定时器

  // 优化的Toast显示函数，避免重复消息
  const showOptimizedToast = useCallback((message: string, type: 'success' | 'error' | 'info') => {
    const now = Date.now();
    // 如果是相同消息且在3秒内，不重复显示
    if (lastToastMessage === message && now - lastToastTime < 3000) {
      return;
    }
    setLastToastMessage(message);
    setLastToastTime(now);
    showToast(message, type);
  }, [lastToastMessage, lastToastTime, showToast]);

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
      console.log('TextTransfer收到消息:', message);

      switch (message.type) {
        case 'websocket-signaling-connected':
          console.log('收到WebSocket信令连接成功事件:', message);
          
          // 立即更新本地信令连接状态
          setCurrentWebSocketConnected(true);
          
          // 只对接收方显示信令连接提示，发送方不需要
          if (currentRole === 'receiver') {
            showOptimizedToast('正在建立连接...', 'success');
          }
          break;

        case 'webrtc-connecting':
          console.log('收到WebRTC数据通道连接中事件:', message);
          // 显示数据通道连接中状态
          break;

        case 'webrtc-connected':
          console.log('收到WebRTC数据通道连接成功事件:', message);
          
          // 清除连接超时定时器
          if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = null;
          }
          
          // 只显示一个简洁的连接成功提示
          showOptimizedToast('连接成功！', 'success');
          break;

        case 'text-content':
          // 接收到文字房间的初始内容或同步内容
          if (message.payload?.text !== undefined) {
            setReceivedText(message.payload.text);
            if (currentRole === 'receiver') {
              setTextContent(message.payload.text);
              // 移除重复的成功消息，因为连接成功时已经显示了
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
          // 接收到发送的文字，不显示Toast，因为UI已经更新了
          if (message.payload?.text) {
            setReceivedText(message.payload.text);
          }
          break;
        
        case 'image-send':
          // 接收到发送的图片
          if (message.payload?.imageData) {
            console.log('接收到图片数据:', message.payload.imageData.substring(0, 100) + '...');
            // 验证图片数据格式
            if (message.payload.imageData.startsWith('data:image/')) {
              setReceivedImages(prev => [...prev, message.payload.imageData]);
              // 只在有实际图片时显示提示
              showOptimizedToast('收到图片', 'success');
            } else {
              console.error('无效的图片数据格式:', message.payload.imageData.substring(0, 50));
              showOptimizedToast('图片格式错误', 'error');
            }
          }
          break;
        
        case 'room-status':
          // 更新房间状态
          if (message.payload?.sender_count !== undefined && message.payload?.receiver_count !== undefined) {
            setConnectedUsers(message.payload.sender_count + message.payload.receiver_count);
          }
          break;

        case 'webrtc-error':
          console.error('收到WebRTC错误事件:', message.payload);
          // 清除连接超时定时器
          if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = null;
          }
          // 结束loading状态
          if (isLoading) {
            setIsLoading(false);
          }
          // 显示错误消息
          if (message.payload?.message) {
            showOptimizedToast(message.payload.message, 'error');
          }
          break;

        case 'websocket-close':
          console.log('收到WebSocket关闭事件:', message.payload);
          // 更新本地连接状态
          setCurrentWebSocketConnected(false);
          // 清除连接超时定时器
          if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = null;
          }
          // 结束loading状态
          if (isLoading) {
            setIsLoading(false);
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
          showOptimizedToast('房间已关闭', 'error');
        }
      }
    };

    const handleWebSocketConnecting = (event: CustomEvent) => {
      console.log('WebSocket正在连接:', event.detail);
      // 可以在这里显示连接中的状态
    };

    const handleWebSocketError = (event: CustomEvent) => {
      console.error('WebSocket连接错误:', event.detail);
      
      // 如果是在loading状态下出现错误，结束loading并显示错误
      if (isLoading) {
        setIsLoading(false);
        showOptimizedToast('连接失败', 'error');
      }
      
      // 清除连接超时定时器
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
    };

    window.addEventListener('websocket-message', handleWebSocketMessage as EventListener);
    window.addEventListener('websocket-connecting', handleWebSocketConnecting as EventListener);
    window.addEventListener('websocket-close', handleWebSocketClose as EventListener);
    window.addEventListener('websocket-error', handleWebSocketError as EventListener);
    
    return () => {
      window.removeEventListener('websocket-message', handleWebSocketMessage as EventListener);
      window.removeEventListener('websocket-connecting', handleWebSocketConnecting as EventListener);
      window.removeEventListener('websocket-close', handleWebSocketClose as EventListener);
      window.removeEventListener('websocket-error', handleWebSocketError as EventListener);
      
      // 清理定时器
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
    };
  }, [currentRole, showOptimizedToast, hasShownJoinSuccess, isLoading]);

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
    // 必须通过WebRTC数据通道发送，不能通过WebSocket信令
    if (!websocket || !isConnected) {
      console.log('WebRTC数据通道未连接，无法发送实时更新。信令状态:', isWebSocketConnected, '数据通道状态:', isConnected);
      return;
    }

    // 清除之前的定时器
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    // 设置新的定时器，防抖动
    updateTimeoutRef.current = setTimeout(() => {
      // 通过WebRTC数据通道发送实时更新
      websocket.send(JSON.stringify({
        type: 'text-update',
        payload: { text }
      }));
    }, 300); // 300ms防抖
  }, [websocket, isConnected, isWebSocketConnected]);

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
    setIsLoading(true);
    try {
      // 使用统一的API创建房间（不区分类型）
      const response = await fetch('/api/create-room', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}), // 空对象即可
      });

      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.message || '创建房间失败');
      }

      const code = data.code;
      setRoomCode(code);
      setIsRoomCreated(true);
      setIsLoading(false); // 立即结束loading，显示UI
      // 移除创建成功Toast，UI变化已经足够明显
      
      // 立即创建WebSocket连接用于实时同步
      if (onCreateWebSocket) {
        console.log('房间创建成功，立即建立WebRTC连接:', code);
        onCreateWebSocket(code, 'sender');
      }
    } catch (error) {
      console.error('创建房间失败:', error);
      showOptimizedToast(error instanceof Error ? error.message : '创建失败', 'error');
      setIsLoading(false);
    }
  }, [onCreateWebSocket, showOptimizedToast]);

  // 加入房间
  const handleJoinRoom = useCallback(async () => {
    if (!roomCode.trim() || roomCode.length !== 6) {
      showOptimizedToast('请输入6位房间码', 'error');
      return;
    }

    // 防止重复加入
    if (isLoading) {
      return;
    }

    setIsLoading(true);
    
    try {
      // 先查询房间信息，确认房间存在
      const roomInfoResponse = await fetch(`/api/room-info?code=${roomCode}`);
      const roomData = await roomInfoResponse.json();
      
      if (!roomInfoResponse.ok || !roomData.success) {
        showOptimizedToast(roomData.message || '房间不存在', 'error');
        setIsLoading(false);
        return;
      }

      // 房间存在，立即显示界面和文本框
      setHasShownJoinSuccess(true);
      setReceivedText(''); // 立即设置为空字符串以显示文本框
      setIsLoading(false); // 立即结束loading，显示UI
      // 移除加入成功Toast，UI变化已经足够明显
      
      // 创建WebSocket连接用于实时同步
      if (onCreateWebSocket) {
        console.log('房间验证成功，开始建立WebRTC连接:', roomCode);
        onCreateWebSocket(roomCode, 'receiver');
      }
    } catch (error) {
      console.error('加入房间失败:', error);
      showOptimizedToast('网络错误', 'error');
      setIsLoading(false);
    }
  }, [roomCode, onCreateWebSocket, showOptimizedToast, isLoading]);

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
            showOptimizedToast('处理中...', 'info');
            const compressedImageData = await compressImage(file);
            setSentImages(prev => [...prev, compressedImageData]);
            
            // 必须通过WebRTC数据通道发送图片
            if (websocket && isConnected) {
              websocket.send(JSON.stringify({
                type: 'image-send',
                payload: { imageData: compressedImageData }
              }));
              // 移除发送成功Toast，视觉反馈已经足够
            } else {
              showOptimizedToast('连接断开', 'error');
            }
          } catch (error) {
            console.error('图片处理失败:', error);
            showOptimizedToast('处理失败', 'error');
          }
        }
      }
    }
  }, [websocket, isConnected, showOptimizedToast, compressImage]);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showOptimizedToast('已复制', 'success');
    } catch (err) {
      showOptimizedToast('复制失败', 'error');
    }
  }, [showOptimizedToast]);

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
    showOptimizedToast('已保存', 'success');
  }, [showOptimizedToast]);

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
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-4 sm:p-6 animate-fade-in-up">
          {/* 功能标题和状态 */}
          <div className="flex items-center mb-6">
            <div className="flex items-center space-x-3 flex-1">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-800">传送文字</h2>
                <p className="text-sm text-slate-600">
                  {isRoomCreated ? '实时编辑，对方可以同步看到' : '输入要传输的文本内容'}
                </p>
              </div>
            </div>
            
            {/* 竖线分割 */}
            <div className="w-px h-12 bg-slate-200 mx-4"></div>
            
            {/* 状态显示 */}
            <div className="text-right">
              <div className="text-sm text-slate-500 mb-1">连接状态</div>
              <div className="flex items-center justify-end space-x-3 text-sm">
                {/* WebSocket信令状态 */}
                <div className="flex items-center space-x-1">
                  {isRoomCreated ? (
                    isWebSocketConnected ? (
                      <>
                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                        <span className="text-blue-600">WS</span>
                      </>
                    ) : (
                      <>
                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                        <span className="text-red-600">WS</span>
                      </>
                    )
                  ) : (
                    <>
                      <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                      <span className="text-slate-600">WS</span>
                    </>
                  )}
                </div>
                
                {/* 分隔符 */}
                <div className="text-slate-300">|</div>
                
                {/* WebRTC数据通道状态 */}
                <div className="flex items-center space-x-1">
                  {isRoomCreated ? (
                    isConnected ? (
                      <>
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-emerald-600">RTC</span>
                      </>
                    ) : (
                      <>
                        <div className="w-2 h-2 rounded-full bg-orange-400"></div>
                        <span className="text-orange-600">RTC</span>
                      </>
                    )
                  ) : (
                    <>
                      <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                      <span className="text-slate-600">RTC</span>
                    </>
                  )}
                </div>
              </div>
              {connectedUsers > 0 && (
                <div className="mt-1 text-xs text-blue-600">
                  {connectedUsers} 人在线
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">

            {!isRoomCreated ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center">
                  <MessageSquare className="w-10 h-10 text-blue-500" />
                </div>
                <h3 className="text-xl font-semibold text-slate-800 mb-4">创建文字传输房间</h3>
                <p className="text-slate-600 mb-8">创建房间后可以实时同步文字内容</p>
                
                <Button
                  onClick={handleCreateRoom}
                  disabled={isLoading}
                  className="px-8 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white text-lg font-medium rounded-xl shadow-lg"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      创建中...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5 mr-2" />
                      创建文字传输房间
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* 文字编辑区域 - 移到最上面 */}
                <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-lg font-medium text-slate-800 flex items-center">
                      <MessageSquare className="w-5 h-5 mr-2" />
                      文字内容
                    </h4>
                    <div className="flex items-center space-x-3 text-sm">
                      <span className="text-slate-500">{textContent.length} / 50,000 字符</span>
                      {isConnected && (
                        <div className="flex items-center space-x-1 bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md">
                          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                          <span className="font-medium">WebRTC实时同步</span>
                        </div>
                      )}
                      {isWebSocketConnected && !isConnected && (
                        <div className="flex items-center space-x-1 bg-blue-100 text-blue-700 px-2 py-1 rounded-md">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                          <span className="font-medium">建立数据通道中</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="relative">
                    <textarea
                      ref={textareaRef}
                      value={textContent}
                      onChange={handleTextChange}
                      onPaste={handlePaste}
                      placeholder="在这里编辑文字内容...&#10;&#10;💡 支持实时同步编辑，对方可以看到你的修改&#10;💡 可以直接粘贴图片 (Ctrl+V)"
                      className="w-full min-h-[200px] p-4 border-2 border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-emerald-500 bg-white/80 backdrop-blur-sm resize-none"
                      disabled={isLoading}
                    />
                  </div>
                  
                  <div className="mt-3">
                    <div className="text-xs text-slate-500">
                      💡 文字会自动保存并实时同步给接收方
                    </div>
                  </div>
                </div>

                {/* 房间信息卡片 - 类似文件传输的布局 */}
                <div className="space-y-6">
                  {/* 已发送的图片 - 移到最上面 */}
                  {mode === 'send' && sentImages.length > 0 && (
                    <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-slate-200">
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

                  {/* 左上角状态提示 - 类似已选择文件的风格 */}
                  <div className="flex items-center">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center">
                        <MessageSquare className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-slate-800">取件码生成成功！</h3>
                        <p className="text-sm text-slate-600">分享以下信息给接收方，支持实时文本同步</p>
                      </div>
                    </div>
                  </div>

                  {/* 中间区域：取件码 + 分隔线 + 二维码 */}
                  <div className="flex flex-col lg:flex-row lg:items-start gap-6 lg:gap-8">
                    {/* 左侧：取件码 */}
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-slate-700 mb-3">取件码</label>
                      <div className="flex flex-col items-center rounded-xl border border-slate-200 p-6 h-40 justify-center bg-slate-50">
                        <div className="text-2xl font-bold font-mono bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent tracking-wider">
                          {roomCode}
                        </div>
                      </div>
                      <Button
                        onClick={() => copyToClipboard(roomCode)}
                        className="w-full px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium shadow transition-all duration-200 mt-3"
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        复制取件码
                      </Button>
                    </div>

                    {/* 分隔线 - 大屏幕显示竖线，移动端隐藏 */}
                    <div className="hidden lg:block w-px bg-slate-200 h-64 mt-6"></div>

                    {/* 右侧：二维码 */}
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-slate-700 mb-3">扫码传输</label>
                      <div className="flex flex-col items-center rounded-xl border border-slate-200 p-6 h-40 justify-center bg-slate-50">
                        <QRCodeDisplay 
                          value={`${typeof window !== 'undefined' ? window.location.origin + window.location.pathname : ''}?type=text&mode=receive&code=${roomCode}`}
                          size={120}
                          title=""
                          className="w-auto"
                        />
                      </div>
                      <div className="w-full px-4 py-2.5 bg-blue-500 text-white rounded-lg font-medium shadow transition-all duration-200 mt-3 text-center">
                        使用手机扫码快速访问
                      </div>
                    </div>
                  </div>

                  {/* 底部：取件链接 */}
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <div className="flex-1 code-display rounded-lg p-3 bg-slate-50 border border-slate-200">
                        <div className="text-sm text-slate-700 break-all font-mono leading-relaxed">
                          {`${typeof window !== 'undefined' ? window.location.origin + window.location.pathname : ''}?type=text&mode=receive&code=${roomCode}`}
                        </div>
                      </div>
                      <Button
                        onClick={() => copyTransferLink(roomCode)}
                        className="px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium shadow transition-all duration-200 shrink-0"
                      >
                        <Link className="w-4 h-4 mr-2" />
                        复制链接
                      </Button>
                    </div>
                  </div>                                
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-4 sm:p-6 animate-fade-in-up">
          {/* 功能标题和状态 */}
          <div className="flex items-center mb-6">
            <div className="flex items-center space-x-3 flex-1">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center">
                <Download className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-800">加入房间</h2>
                <p className="text-sm text-slate-600">
                  {(receivedText !== '' || textContent || hasShownJoinSuccess) ? 
                    (isConnected ? '已连接，可以实时查看和编辑' : '连接断开，等待重连') : 
                    '输入6位房间码来获取文字内容'
                  }
                </p>
              </div>
            </div>
            
            {/* 竖线分割 */}
            <div className="w-px h-12 bg-slate-200 mx-4"></div>
            
            {/* 状态显示 */}
            <div className="text-right">
              <div className="text-sm text-slate-500 mb-1">连接状态</div>
              <div className="flex items-center justify-end space-x-3 text-sm">
                {/* WebSocket信令状态 */}
                <div className="flex items-center space-x-1">
                  {(receivedText !== '' || textContent || hasShownJoinSuccess) ? (
                    isWebSocketConnected ? (
                      <>
                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                        <span className="text-blue-600">WS</span>
                      </>
                    ) : (
                      <>
                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                        <span className="text-red-600">WS</span>
                      </>
                    )
                  ) : (
                    <>
                      <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                      <span className="text-slate-600">WS</span>
                    </>
                  )}
                </div>
                
                {/* 分隔符 */}
                <div className="text-slate-300">|</div>
                
                {/* WebRTC数据通道状态 */}
                <div className="flex items-center space-x-1">
                  {(receivedText !== '' || textContent || hasShownJoinSuccess) ? (
                    isConnected ? (
                      <>
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-emerald-600">RTC</span>
                      </>
                    ) : (
                      <>
                        <div className="w-2 h-2 rounded-full bg-orange-400"></div>
                        <span className="text-orange-600">RTC</span>
                      </>
                    )
                  ) : (
                    <>
                      <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                      <span className="text-slate-600">RTC</span>
                    </>
                  )}
                </div>
              </div>
              {connectedUsers > 0 && (
                <div className="mt-1 text-xs text-blue-600">
                  {connectedUsers} 人在线
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {/* 如果已经加入房间（hasShownJoinSuccess）或获取到文字内容，将文字输入框显示在上方 */}
            {(receivedText !== '' || textContent || hasShownJoinSuccess) && (
              <div className="space-y-4">
                <div className="relative">
                  <textarea
                    value={receivedText || textContent}
                    readOnly={true}
                    placeholder={receivedText === '' && textContent === '' ? '等待接收文本内容...' : ''}
                    className="w-full min-h-[200px] p-4 border-2 border-emerald-200 rounded-xl bg-emerald-50/50 backdrop-blur-sm resize-none cursor-default"
                  />
                  {isConnected && (
                    <div className="absolute top-2 right-2">
                      <div className="flex items-center space-x-1 bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg text-xs">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                        <span>WebRTC实时同步</span>
                      </div>
                    </div>
                  )}
                  {isWebSocketConnected && !isConnected && (
                    <div className="absolute top-2 right-2">
                      <div className="flex items-center space-x-1 bg-blue-100 text-blue-700 px-2 py-1 rounded-lg text-xs">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span>建立数据通道中</span>
                      </div>
                    </div>
                  )}
                  {!isWebSocketConnected && !isConnected && (
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
            
            {/* 只有在未加入房间时才显示输入框和加入按钮 */}
            {!(receivedText !== '' || textContent || hasShownJoinSuccess) && (
              <>
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
              </>
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
