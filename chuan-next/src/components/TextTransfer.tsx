"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageSquare, Copy, Send, Download } from 'lucide-react';
import { useToast } from '@/components/ui/toast-simple';

interface TextTransferProps {
  onSendText?: (text: string) => Promise<string>; // 返回取件码
  onReceiveText?: (code: string) => Promise<string>; // 返回文本内容
}

export default function TextTransfer({ onSendText, onReceiveText }: TextTransferProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [mode, setMode] = useState<'send' | 'receive'>('send');
  const [textContent, setTextContent] = useState('');
  const [pickupCode, setPickupCode] = useState('');
  const [receivedText, setReceivedText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { showToast } = useToast();

  // 从URL参数中获取初始模式
  useEffect(() => {
    const urlMode = searchParams.get('mode') as 'send' | 'receive';
    const type = searchParams.get('type');
    
    if (type === 'text' && urlMode && ['send', 'receive'].includes(urlMode)) {
      setMode(urlMode);
    }
  }, [searchParams]);

  // 更新URL参数
  const updateMode = useCallback((newMode: 'send' | 'receive') => {
    setMode(newMode);
    const params = new URLSearchParams(searchParams.toString());
    params.set('type', 'text');
    params.set('mode', newMode);
    router.push(`?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  const handleSendText = useCallback(async () => {
    if (!textContent.trim() || !onSendText) return;
    
    setIsLoading(true);
    try {
      const code = await onSendText(textContent);
      setPickupCode(code);
      showToast('文本已生成取件码！', 'success');
    } catch (error) {
      console.error('发送文本失败:', error);
      showToast('发送失败，请重试', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [textContent, onSendText, showToast]);

  const handleReceiveText = useCallback(async () => {
    if (!pickupCode.trim() || !onReceiveText) return;
    
    setIsLoading(true);
    try {
      const text = await onReceiveText(pickupCode);
      setReceivedText(text);
      showToast('文本接收成功！', 'success');
    } catch (error) {
      console.error('接收文本失败:', error);
      showToast('接收失败，请检查取件码', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [pickupCode, onReceiveText, showToast]);

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
            发送文本
          </Button>
          <Button
            variant={mode === 'receive' ? 'default' : 'ghost'}
            onClick={() => updateMode('receive')}
            className="px-6 py-2 rounded-lg"
          >
            <Download className="w-4 h-4 mr-2" />
            接收文本
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
            <p className="text-sm sm:text-base text-slate-600">输入要传输的文本内容</p>
          </div>

          <div className="space-y-4">
            <textarea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="在这里输入要传输的文本内容..."
              className="w-full min-h-[200px] p-4 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:ring-blue-500 bg-white/80 backdrop-blur-sm resize-none"
              disabled={isLoading}
            />
            
            <div className="flex justify-between text-sm text-slate-500">
              <span>{textContent.length} 字符</span>
              <span>最大 10,000 字符</span>
            </div>

            <Button
              onClick={handleSendText}
              disabled={!textContent.trim() || textContent.length > 10000 || isLoading}
              className="w-full h-12 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white text-lg font-medium rounded-xl shadow-lg"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  生成中...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5 mr-2" />
                  生成取件码
                </>
              )}
            </Button>

            {pickupCode && (
              <div className="mt-6 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-200">
                <div className="text-center">
                  <p className="text-sm text-emerald-700 mb-2">取件码生成成功！</p>
                  <div className="text-2xl font-bold font-mono text-emerald-600 mb-3">{pickupCode}</div>
                  <Button
                    onClick={() => copyToClipboard(pickupCode)}
                    size="sm"
                    className="bg-emerald-500 hover:bg-emerald-600 text-white"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    复制取件码
                  </Button>
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
            <p className="text-sm sm:text-base text-slate-600">输入6位取件码来获取文本</p>
          </div>

          <div className="space-y-4">
            <Input
              value={pickupCode}
              onChange={(e) => setPickupCode(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="请输入取件码"
              className="text-center text-2xl sm:text-3xl tracking-[0.3em] sm:tracking-[0.5em] font-mono h-12 sm:h-16 border-2 border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-emerald-500 bg-white/80 backdrop-blur-sm"
              maxLength={6}
              disabled={isLoading}
            />

            <Button
              onClick={handleReceiveText}
              disabled={pickupCode.length !== 6 || isLoading}
              className="w-full h-12 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white text-lg font-medium rounded-xl shadow-lg"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  获取中...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5 mr-2" />
                  获取文本
                </>
              )}
            </Button>

            {receivedText && (
              <div className="mt-6 space-y-4">
                <textarea
                  value={receivedText}
                  readOnly
                  className="w-full min-h-[200px] p-4 border-2 border-emerald-200 rounded-xl bg-emerald-50/50 backdrop-blur-sm resize-none"
                />
                <Button
                  onClick={() => copyToClipboard(receivedText)}
                  className="w-full h-12 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white text-lg font-medium rounded-xl shadow-lg"
                >
                  <Copy className="w-5 h-5 mr-2" />
                  复制文本
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
