import { NextRequest, NextResponse } from 'next/server';

const GO_BACKEND_URL = process.env.GO_BACKEND_URL || 'http://localhost:8080';

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
    const response = await fetch(`${GO_BACKEND_URL}/api/room-status?code=${code}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error getting room status:', error);
    return NextResponse.json(
      { success: false, message: '获取房间状态失败' },
      { status: 500 }
    );
  }
}
