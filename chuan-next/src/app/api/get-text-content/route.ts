import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();
    
    if (!code || code.length !== 6) {
      return NextResponse.json({ error: '请输入正确的6位房间码' }, { status: 400 });
    }

    // 调用后端API获取文字内容
    const response = await fetch(`http://localhost:8080/api/get-text-content/${code}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: '房间不存在或已过期' }, { status: 404 });
      }
      throw new Error('获取文字内容失败');
    }

    const data = await response.json();
    
    return NextResponse.json({ 
      success: true, 
      text: data.text,
      message: '文字内容获取成功' 
    });

  } catch (error) {
    console.error('获取文字内容错误:', error);
    return NextResponse.json(
      { error: '服务器错误，请重试' }, 
      { status: 500 }
    );
  }
}
