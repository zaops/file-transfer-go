import { NextRequest, NextResponse } from 'next/server';

const GO_BACKEND_URL = process.env.GO_BACKEND_URL || 'http://localhost:8080';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    
    if (!code) {
      return NextResponse.json(
        { error: 'Missing code parameter' },
        { status: 400 }
      );
    }

    console.log('API Route: Getting text content, proxying to:', `${GO_BACKEND_URL}/api/get-text-content?code=${code}`);
    
    const response = await fetch(`${GO_BACKEND_URL}/api/get-text-content?code=${code}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('Backend response status:', response.status);
    console.log('Backend response headers:', Object.fromEntries(response.headers.entries()));
    
    // 检查响应的 Content-Type
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('Backend returned non-JSON response:', text);
      return NextResponse.json(
        { 
          error: 'Backend returned invalid response', 
          details: `Expected JSON, got: ${contentType}`,
          response: text
        },
        { status: 502 }
      );
    }

    const data = await response.json();
    
    console.log('Backend response data:', data);
    
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json(
      { error: 'Failed to get text content', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
