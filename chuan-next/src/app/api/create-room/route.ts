import { NextRequest, NextResponse } from 'next/server';

const GO_BACKEND_URL = process.env.GO_BACKEND_URL || 'http://localhost:8080';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // 转发请求到Go后端
    const response = await fetch(`${GO_BACKEND_URL}/api/create-room`, {
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
