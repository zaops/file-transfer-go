// 文件传输相关类型
export interface FileInfo {
  id: string;
  name: string;
  size: number;
  type: string;
  lastModified?: number;
}

export interface TransferProgress {
  fileId: string;
  originalFileId?: string; // 原始文件ID，用于UI匹配
  fileName: string;
  progress: number;
  receivedSize: number;
  totalSize: number;
  status: 'pending' | 'downloading' | 'uploading' | 'completed' | 'error';
}

export interface RoomStatus {
  code: string;
  file_count: number;
  sender_count: number;
  receiver_count: number;
  clients: {
    id: string;
    role: 'sender' | 'receiver';
    joined_at: string;
    user_agent: string;
  }[];
  created_at: string;
}

export interface FileChunk {
  offset: number;
  data: Uint8Array;
}

export interface WebSocketMessage {
  type: string;
  payload: Record<string, unknown>;
}

// WebSocket 钩子状态
export interface UseWebSocketReturn {
  websocket: WebSocket | null;
  isConnected: boolean;
  connect: (code: string, role: 'sender' | 'receiver') => void;
  disconnect: () => void;
  sendMessage: (message: WebSocketMessage) => void;
}
