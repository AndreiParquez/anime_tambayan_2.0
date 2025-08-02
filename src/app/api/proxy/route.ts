import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
  }

  console.log('Proxy request for URL:', url);

  try {
    // Set headers that the video server expects
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Referer': 'https://kwik.si/', // Updated to match CORS requirement
      'Origin': 'https://kwik.si',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'identity', // Changed from 'gzip, deflate, br' to avoid compression issues
      'Connection': 'keep-alive',
      'Sec-Fetch-Dest': 'video',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'cross-site',
      'Cache-Control': 'no-cache'
    };

    console.log('Fetching with headers:', headers);
    const response = await fetch(url, { headers });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      console.error(`HTTP error! status: ${response.status}`);
      return NextResponse.json(
        { error: `HTTP error! status: ${response.status}` }, 
        { status: response.status }
      );
    }

    // Get the content type from the original response
    const contentType = response.headers.get('content-type') || 'application/vnd.apple.mpegurl';
    const contentLength = response.headers.get('content-length');
    
    console.log('Content-Type:', contentType);
    console.log('Content-Length:', contentLength);

    // For HLS streams (.m3u8), make sure we set the correct content type
    const finalContentType = url.includes('.m3u8') 
      ? 'application/vnd.apple.mpegurl' 
      : contentType;

    // Create a new response with CORS headers
    const proxiedResponse = new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
    });

    // Set CORS headers to allow access from your domain
    proxiedResponse.headers.set('Access-Control-Allow-Origin', '*');
    proxiedResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    proxiedResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Range');
    proxiedResponse.headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range');
    proxiedResponse.headers.set('Content-Type', finalContentType);
    
    if (contentLength) {
      proxiedResponse.headers.set('Content-Length', contentLength);
    }

    // Add cache headers
    proxiedResponse.headers.set('Cache-Control', 'public, max-age=3600');

    console.log('Proxy response successful');
    return proxiedResponse;

  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch the requested resource',
        details: error instanceof Error ? error.message : 'Unknown error',
        url: url
      }, 
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
