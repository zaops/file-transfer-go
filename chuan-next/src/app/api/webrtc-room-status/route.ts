import { NextRequest, NextResponse } from 'next/server';

const GO_BACKEND_URL = process.env.GO_BACKEND_URL || 'http://localhost:8080';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    
    if (!code) {
      return NextResponse.json(
        { success: false, message: '取件码不能为空' },
        { status: 400 }
      );
    }
    
    console.log('API Route: Getting WebRTC room status, proxying to:', `${GO_BACKEND_URL}/api/webrtc-room-status?code=${code}`);
    
    const response = await fetch(`${GO_BACKEND_URL}/api/webrtc-room-status?code=${code}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    
    console.log('Backend response:', response.status, data);
    
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json(
      { success: false, message: '获取房间状态失败', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
