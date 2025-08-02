import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

interface UseUrlHandlerProps {
  isConnected: boolean;
  pickupCode: string;
  setCurrentRole: (role: 'sender' | 'receiver') => void;
  joinRoom: (code: string) => Promise<void>;
}

export const useUrlHandler = ({ isConnected, pickupCode, setCurrentRole, joinRoom }: UseUrlHandlerProps) => {
  const searchParams = useSearchParams();

  // 处理URL参数中的取件码（仅在首次加载时）
  useEffect(() => {
    const code = searchParams.get('code');
    const type = searchParams.get('type');
    const mode = searchParams.get('mode');
    
    // 只有在完整的URL参数情况下才自动加入房间：
    // 1. 有效的6位取件码
    // 2. 当前未连接
    // 3. 不是已经连接的同一个房间码
    // 4. 必须是完整的链接：有type、mode=receive和code参数
    // 5. 不是文字类型（文字类型由TextTransfer组件处理）
    if (code && 
        code.length === 6 && 
        !isConnected && 
        pickupCode !== code.toUpperCase() &&
        type &&
        type !== 'text' &&
        mode === 'receive') {
      console.log('自动加入文件房间:', code.toUpperCase());
      setCurrentRole('receiver');
      joinRoom(code.toUpperCase());
    }
  }, [searchParams]); // 只依赖 searchParams，避免重复触发
};
