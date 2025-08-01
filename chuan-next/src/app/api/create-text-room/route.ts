import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/lib/config';

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    
    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: '文本内容不能为空' }, { status: 400 });
    }

    if (text.length > 50000) {
      return NextResponse.json({ error: '文本内容过长，最大支持50,000字符' }, { status: 400 });
    }

    // 调用后端API创建文字传输房间
    const response = await fetch(getBackendUrl('/api/create-text-room'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      throw new Error('创建文字传输房间失败');
    }

    const data = await response.json();
    
    return NextResponse.json({ 
      success: true, 
      code: data.code,
      message: '文字传输房间创建成功' 
    });

  } catch (error) {
    console.error('创建文字传输房间错误:', error);
    return NextResponse.json(
      { error: '服务器错误，请重试' }, 
      { status: 500 }
    );
  }
}
