import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/lib/config';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    
    if (!code) {
      return NextResponse.json(
        { success: false, message: '缺少取件码' },
        { status: 400 }
      );
    }

    // 转发请求到Go后端
    const response = await fetch(getBackendUrl(`/api/room-info?code=${code}`), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error getting room info:', error);
    return NextResponse.json(
      { success: false, message: '获取房间信息失败' },
      { status: 500 }
    );
  }
}
