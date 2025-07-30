import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, files } = body;

    if (!code || !files) {
      return NextResponse.json(
        { success: false, message: '缺少必要参数' },
        { status: 400 }
      );
    }

    // 转发请求到Go后端
    const backendUrl = process.env.NODE_ENV === 'production' 
      ? `https://${process.env.VERCEL_URL || 'localhost'}/api/update-files`
      : 'http://localhost:8080/api/update-files';

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code, files }),
    });

    const data = await response.json();
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Update files API error:', error);
    return NextResponse.json(
      { success: false, message: '服务器错误' },
      { status: 500 }
    );
  }
}
