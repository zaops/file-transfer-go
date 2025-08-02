import { useCallback } from 'react';
import { useToast } from '@/components/ui/toast-simple';

export const useUtilities = () => {
  const { showToast } = useToast();

  // 复制到剪贴板
  const copyToClipboard = useCallback(async (text: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(successMessage, 'success');
    } catch (err) {
      console.error('复制失败:', err);
      showToast('复制失败，请手动复制', 'error');
    }
  }, [showToast]);

  // 显示通知
  const showNotification = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    console.log(`[${type.toUpperCase()}] ${message}`);
    showToast(message, type);
  }, [showToast]);

  return {
    copyToClipboard,
    showNotification
  };
};
