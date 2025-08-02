import { useState, useCallback, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

export const useTabManager = (isConnected: boolean, pickupCode: string, isConnecting: boolean) => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'file' | 'text' | 'desktop'>('file');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingTabSwitch, setPendingTabSwitch] = useState<string>('');

  // 从URL参数中获取初始状态
  useEffect(() => {
    const type = searchParams.get('type') as 'file' | 'text' | 'desktop';
    
    if (type && ['file', 'text', 'desktop'].includes(type)) {
      setActiveTab(type);
    }
  }, [searchParams]);

  // 更新URL参数
  const updateUrlParams = useCallback((tab: string, mode?: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('type', tab);
    if (mode) {
      params.set('mode', mode);
    }
    router.push(`?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  // 处理tab切换
  const handleTabChange = useCallback((value: string) => {
    // 检查是否已经建立连接或生成取件码
    const hasActiveConnection = isConnected || pickupCode || isConnecting;
    
    if (hasActiveConnection && value !== activeTab) {
      // 如果已有活跃连接且要切换到不同的tab，显示确认对话框
      setPendingTabSwitch(value);
      setShowConfirmDialog(true);
      return;
    }
    
    // 如果没有活跃连接，正常切换
    setActiveTab(value as 'file' | 'text' | 'desktop');
    updateUrlParams(value);
  }, [updateUrlParams, isConnected, pickupCode, isConnecting, activeTab]);

  // 确认切换tab
  const confirmTabSwitch = useCallback(() => {
    if (pendingTabSwitch) {
      const currentUrl = window.location.origin + window.location.pathname;
      const newUrl = `${currentUrl}?type=${pendingTabSwitch}`;
      
      // 在新标签页打开
      window.open(newUrl, '_blank');
      
      // 关闭对话框并清理状态
      setShowConfirmDialog(false);
      setPendingTabSwitch('');
    }
  }, [pendingTabSwitch]);

  // 取消切换tab
  const cancelTabSwitch = useCallback(() => {
    setShowConfirmDialog(false);
    setPendingTabSwitch('');
  }, []);

  // 获取模式描述
  const getModeDescription = useCallback(() => {
    let currentMode = '';
    let targetMode = '';
    
    switch (activeTab) {
      case 'file':
        currentMode = '文件传输';
        break;
      case 'text':
        currentMode = '文字传输';
        break;
      case 'desktop':
        currentMode = '桌面共享';
        break;
    }
    
    switch (pendingTabSwitch) {
      case 'file':
        targetMode = '文件传输';
        break;
      case 'text':
        targetMode = '文字传输';
        break;
      case 'desktop':
        targetMode = '桌面共享';
        break;
    }
    
    return `当前${currentMode}会话进行中，是否要在新标签页中打开${targetMode}？`;
  }, [activeTab, pendingTabSwitch]);

  return {
    activeTab,
    showConfirmDialog,
    setShowConfirmDialog,
    handleTabChange,
    confirmTabSwitch,
    cancelTabSwitch,
    getModeDescription,
    updateUrlParams
  };
};
