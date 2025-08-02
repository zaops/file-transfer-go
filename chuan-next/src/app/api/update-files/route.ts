import { NextRequest, NextResponse } from 'next/server';

const GO_BACKEND_URL = process.env.GO_BACKEND_URL || 'http://localhost:8080';

export async function POST(request: NextRequest) {
  try {
    console.log('API Route: Updating files, proxying to:', `${GO_BACKEND_URL}/api/update-files`);
    
    const body = await request.json();
    
    const response = await fetch(`${GO_BACKEND_URL}/api/update-files`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    
    console.log('Backend response:', response.status, data);
    
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json(
      { error: 'Failed to update files', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
