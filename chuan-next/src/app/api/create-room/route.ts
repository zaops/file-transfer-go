import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/lib/config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // 使用配置管理获取后端URL
    const backendUrl = getBackendUrl('/api/create-room');
    
    // 转发请求到Go后端
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error creating room:', error);
    return NextResponse.json(
      { success: false, message: '创建房间失败' },
      { status: 500 }
    );
  }
}
