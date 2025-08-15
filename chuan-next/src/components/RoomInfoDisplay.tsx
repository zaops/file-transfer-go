"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import QRCodeDisplay from '@/components/QRCodeDisplay';
import { LucideIcon } from 'lucide-react';

interface RoomInfoDisplayProps {
  // 房间信息
  code: string;
  link: string;
  
  // 显示配置
  icon: LucideIcon;
  iconColor?: string; // 图标背景渐变色，如 'from-emerald-500 to-teal-500'
  codeColor?: string; // 代码文字渐变色，如 'from-emerald-600 to-teal-600'
  
  // 文案配置
  title: string; // 如 "取件码生成成功！" 或 "房间码生成成功！"
  subtitle: string; // 如 "分享以下信息给接收方" 或 "分享以下信息给观看方"
  codeLabel: string; // 如 "取件码" 或 "房间代码"
  qrLabel: string; // 如 "扫码传输" 或 "扫码观看"
  copyButtonText: string; // 如 "复制取件码" 或 "复制房间代码"
  copyButtonColor?: string; // 复制按钮颜色，如 'bg-emerald-500 hover:bg-emerald-600'
  qrButtonText: string; // 如 "使用手机扫码快速访问" 或 "使用手机扫码快速观看"
  linkButtonText: string; // 如 "复制取件链接" 或 "复制观看链接"
  
  // 事件回调
  onCopyCode: () => void;
  onCopyLink: () => void;
  
  // 样式配置
  className?: string;
}

export default function RoomInfoDisplay({
  code,
  link,
  icon: Icon,
  iconColor = 'from-emerald-500 to-teal-500',
  codeColor = 'from-emerald-600 to-teal-600',
  title,
  subtitle,
  codeLabel,
  qrLabel,
  copyButtonText,
  copyButtonColor = 'bg-emerald-500 hover:bg-emerald-600',
  qrButtonText,
  linkButtonText,
  onCopyCode,
  onCopyLink,
  className = ''
}: RoomInfoDisplayProps) {
  return (
    <div className={`border-t border-slate-200 pt-6 ${className}`}>
      {/* 左上角状态提示 */}
      <div className="flex items-center mb-6">
        <div className="flex items-center space-x-3">
          <div className={`w-10 h-10 bg-gradient-to-br ${iconColor} rounded-xl flex items-center justify-center`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
            <p className="text-sm text-slate-600">{subtitle}</p>
          </div>
        </div>
      </div>

      {/* 中间区域：代码 + 分隔线 + 二维码 */}
      <div className="flex flex-col lg:flex-row lg:items-start gap-6 lg:gap-8 mb-8">
        {/* 左侧：代码 */}
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-700 mb-3">{codeLabel}</label>
          <div className="flex flex-col items-center rounded-xl border border-slate-200 p-6 h-40 justify-center bg-slate-50">
            <div className={`text-2xl font-bold font-mono bg-gradient-to-r ${codeColor} bg-clip-text text-transparent tracking-wider`}>
              {code}
            </div>
          </div>
          <Button
            onClick={onCopyCode}
            className={`w-full px-4 py-2.5 ${copyButtonColor} text-white rounded-lg font-medium shadow transition-all duration-200 mt-3`}
          >
            {copyButtonText}
          </Button>
        </div>

        {/* 分隔线 - 大屏幕显示竖线，移动端隐藏 */}
        <div className="hidden lg:block w-px bg-slate-200 h-64 mt-6"></div>

        {/* 右侧：二维码 */}
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-700 mb-3">{qrLabel}</label>
          <div className="flex flex-col items-center rounded-xl border border-slate-200 p-6 h-40 justify-center bg-slate-50">
            <QRCodeDisplay 
              value={link}
              size={120}
            />
          </div>
          <div className="w-full px-4 py-2.5 bg-blue-500 text-white rounded-lg font-medium shadow transition-all duration-200 mt-3 text-center">
            {qrButtonText}
          </div>
        </div>
      </div>

      {/* 底部：链接 */}
      <div className="space-y-3">
        <div className="flex gap-3">
          <div className="flex-1 code-display rounded-lg p-3 bg-slate-50 border border-slate-200">
            <div className="text-sm text-slate-700 break-all font-mono leading-relaxed">
              {link}
            </div>
          </div>
          <Button
            onClick={onCopyLink}
            className="px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium shadow transition-all duration-200 shrink-0"
          >
            {linkButtonText}
          </Button>
        </div>
      </div>
    </div>
  );
}
