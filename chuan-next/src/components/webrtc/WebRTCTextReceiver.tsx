"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSharedWebRTCManager } from '@/hooks/webrtc/useSharedWebRTCManager';
import { useTextTransferBusiness } from '@/hooks/webrtc/useTextTransferBusiness';
import { useFileTransferBusiness } from '@/hooks/webrtc/useFileTransferBusiness';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast-simple';
import { MessageSquare, Image, Download } from 'lucide-react';

interface WebRTCTextReceiverProps {
  initialCode?: string;
  onPreviewImage: (imageUrl: string) => void;
  onRestart?: () => void;
}

export const WebRTCTextReceiver: React.FC<WebRTCTextReceiverProps> = ({
  initialCode = '',
  onPreviewImage,
  onRestart
}) => {
  const { showToast } = useToast();

  // 状态管理
  const [pickupCode, setPickupCode] = useState('');
  const [inputCode, setInputCode] = useState(initialCode);
  const [receivedText, setReceivedText] = useState(''); // 实时接收的文本内容
  const [receivedImages, setReceivedImages] = useState<Array<{ id: string, content: string, fileName?: string }>>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const hasTriedAutoConnect = useRef(false);


  // 创建共享连接 [需要优化]
  const connection = useSharedWebRTCManager();

  // 使用共享连接创建业务层
  const textTransfer = useTextTransferBusiness(connection);
  const fileTransfer = useFileTransferBusiness(connection);

  // 连接所有传输通道
  const connectAll = useCallback(async (code: string, role: 'sender' | 'receiver') => {
    console.log('=== 连接所有传输通道 ===', { code, role });
    await Promise.all([
      textTransfer.connect(code, role),
      fileTransfer.connect(code, role)
    ]);
  }, [textTransfer, fileTransfer]);

  // 是否有任何连接
  const hasAnyConnection = textTransfer.isConnected || fileTransfer.isConnected;

  // 是否正在连接
  const isAnyConnecting = textTransfer.isConnecting || fileTransfer.isConnecting;


  // 是否有任何错误
  const hasAnyError = textTransfer.connectionError || fileTransfer.connectionError;

  // 监听连接错误并显示 toast
  useEffect(() => {
    if (hasAnyError) {
      console.error('[WebRTCTextReceiver] 连接错误:', hasAnyError);
      showToast(hasAnyError, 'error');
    }
  }, [hasAnyError, showToast]);

  // 验证取件码是否存在
  const validatePickupCode = async (code: string): Promise<boolean> => {
    try {
      setIsValidating(true);

      console.log('开始验证取件码:', code);
      const response = await fetch(`/api/room-info?code=${code}`);
      const data = await response.json();

      console.log('验证响应:', { status: response.status, data });

      if (!response.ok || !data.success) {
        const errorMessage = data.message || '取件码验证失败';
        showToast(errorMessage, 'error');
        console.log('验证失败:', errorMessage);
        return false;
      }

      console.log('取件码验证成功:', data.room);
      return true;
    } catch (error) {
      console.error('验证取件码时发生错误:', error);
      const errorMessage = '网络错误，请检查连接后重试';
      showToast(errorMessage, 'error');
      return false;
    } finally {
      setIsValidating(false);
    }
  };

  // 重新开始
  const restart = () => {
    setPickupCode('');
    setInputCode('');
    setReceivedText('');
    setReceivedImages([]);
    setIsTyping(false);

    // 断开连接
    textTransfer.disconnect();
    fileTransfer.disconnect();

    if (onRestart) {
      onRestart();
    }
  };

  // 加入房间
  const joinRoom = useCallback(async (code: string) => {
    const trimmedCode = code.trim().toUpperCase();

    if (!trimmedCode || trimmedCode.length !== 6) {
      showToast('请输入正确的6位取件码', "error");
      return;
    }

    if (isAnyConnecting || isValidating) {
      console.log('已经在连接中，跳过重复请求');
      return;
    }

    if (hasAnyConnection) {
      console.log('已经连接，跳过重复请求');
      return;
    }

    try {
      console.log('=== 开始验证和连接房间 ===', trimmedCode);

      const isValid = await validatePickupCode(trimmedCode);
      if (!isValid) {
        return;
      }

      setPickupCode(trimmedCode);
      await connectAll(trimmedCode, 'receiver');

      console.log('=== 房间连接成功 ===', trimmedCode);
      showToast(`成功加入消息房间: ${trimmedCode}`, "success");
    } catch (error) {
      console.error('加入房间失败:', error);
      showToast(error instanceof Error ? error.message : '加入房间失败', "error");
      setPickupCode('');
    }
  }, [isAnyConnecting, hasAnyConnection, connectAll, showToast, isValidating, validatePickupCode]);

  // 监听实时文本同步
  useEffect(() => {
    const cleanup = textTransfer.onTextSync((text: string) => {
      setReceivedText(text);
    });

    return cleanup;
  }, [textTransfer.onTextSync]);

  // 监听打字状态
  useEffect(() => {
    const cleanup = textTransfer.onTypingStatus((typing: boolean) => {
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
          setReceivedImages(prev => [...prev, {
            id: fileData.id,
            content: imageData,
            fileName: fileData.file.name
          }]);
        };
        reader.readAsDataURL(fileData.file);
      }
    });

    return cleanup;
  }, [fileTransfer.onFileReceived]);

  // 处理初始代码连接
  useEffect(() => {
    // initialCode isAutoConnected
    console.log(`initialCode: ${initialCode}, hasTriedAutoConnect: ${hasTriedAutoConnect.current}`);
    if (initialCode && initialCode.length === 6 && !hasTriedAutoConnect.current) {
      console.log('=== 自动连接初始代码 ===', initialCode);
      hasTriedAutoConnect.current = true
      setInputCode(initialCode);
      joinRoom(initialCode);
      return;
    }
  }, [initialCode]);

  return (
    <div className="space-y-6">
      {!hasAnyConnection ? (
        // 输入取件码界面
        <div>
          <div className="flex items-center mb-6 sm:mb-8">
            <div className="flex items-center space-x-3 flex-1">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center">
                <Download className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-800">输入取件码</h2>
                <p className="text-sm text-slate-600">请输入6位取件码来获取实时文字内容</p>
              </div>
            </div>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); joinRoom(inputCode); }} className="space-y-4 sm:space-y-6">
            <div className="space-y-3">
              <div className="relative">
                <Input
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.replace(/[^A-Z0-9]/g, '').toUpperCase())}
                  placeholder="请输入取件码"
                  className="text-center text-2xl sm:text-3xl tracking-[0.3em] sm:tracking-[0.5em] font-mono h-12 sm:h-16 border-2 border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-emerald-500 bg-white/80 backdrop-blur-sm pb-2 sm:pb-4"
                  maxLength={6}
                  disabled={isValidating || isAnyConnecting}
                />
              </div>
              <p className="text-center text-xs sm:text-sm text-slate-500">
                {inputCode.length}/6 位
              </p>
            </div>

            <div className="flex justify-center">
              <Button
                type="submit"
                disabled={inputCode.length !== 6 || isValidating || isAnyConnecting}
                className="w-full h-10 sm:h-12 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white text-base sm:text-lg font-medium rounded-xl shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:scale-100"
              >
                {isValidating ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>验证中...</span>
                  </div>
                ) : isAnyConnecting ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>连接中...</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <Download className="w-5 h-5" />
                    <span>获取文字</span>
                  </div>
                )}
              </Button>
            </div>
          </form>
        </div>
      ) : (
        // 已连接，显示实时文本
        <div className="space-y-6">
          <div className="flex items-center mb-6">
            <div className="flex items-center space-x-3 flex-1">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-800">实时文字内容</h3>
                <p className="text-sm text-slate-500">
                  <span className="text-emerald-600">✅ 已连接，正在实时接收文字</span>
                </p>
              </div>
            </div>
          </div>

          {/* 连接成功状态 */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6">
            <h4 className="font-semibold text-emerald-800 mb-1">已连接到文字房间</h4>
            <p className="text-emerald-700">取件码: {pickupCode}</p>
          </div>

          {/* 实时文本显示区域 */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-lg font-medium text-slate-800 flex items-center">
                <MessageSquare className="w-5 h-5 mr-2" />
                实时文字内容
              </h4>
              <div className="flex items-center space-x-3 text-sm">
                <span className="text-slate-500">
                  {receivedText.length} / 50,000 字符
                </span>
                {textTransfer.isConnected && (
                  <div className="flex items-center space-x-1 bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                    <span className="font-medium">WebRTC实时同步</span>
                  </div>
                )}
              </div>
            </div>

            <div className="relative">
              <textarea
                value={receivedText}
                readOnly
                placeholder="等待对方发送文字内容...&#10;&#10;💡 实时同步显示，对方的编辑会立即显示在这里"
                className="w-full h-40 px-4 py-3 border border-slate-300 rounded-lg bg-slate-50 text-slate-700 placeholder-slate-400 resize-none"
              />
              {!receivedText && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-50 rounded-lg border border-slate-300">
                  <div className="text-center">
                    <MessageSquare className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-600">等待接收文字内容...</p>
                    <p className="text-sm text-slate-500 mt-2">对方发送的文字将在这里实时显示</p>
                  </div>
                </div>
              )}
            </div>

            {/* 打字状态提示 */}
            {isTyping && (
              <div className="flex items-center space-x-2 mt-3 text-sm text-slate-500">
                <div className="flex space-x-1">
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className="w-1 h-1 bg-slate-400 rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 0.1}s` }}
                    ></div>
                  ))}
                </div>
                <span className="italic">对方正在输入...</span>
              </div>
            )}
          </div>

          {/* 接收到的图片 */}
          {receivedImages.length > 0 && (
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-slate-200">
              <h4 className="text-lg font-semibold text-slate-800 mb-4">接收的图片</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {receivedImages.map((image) => (
                  <img
                    key={image.id}
                    src={image.content}
                    alt={image.fileName}
                    className="w-full h-32 object-cover rounded-lg border cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => onPreviewImage(image.content)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
