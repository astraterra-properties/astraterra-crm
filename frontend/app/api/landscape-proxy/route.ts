import { NextRequest } from 'next/server';
import http from 'http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Custom proxy with no timeout limit (Next.js rewrite proxy defaults ~30s which is too short)
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const contentType = req.headers.get('content-type') || '';
    const bodyBuffer = Buffer.from(await req.arrayBuffer());

    const result = await new Promise<{ status: number; body: Buffer; contentType: string }>(
      (resolve, reject) => {
        const options: http.RequestOptions = {
          hostname: 'localhost',
          port: 4000,
          path: '/api/analyse',
          method: 'POST',
          headers: {
            'content-type': contentType,
            'content-length': bodyBuffer.length,
          },
        };

        const proxyReq = http.request(options, (proxyRes) => {
          const chunks: Buffer[] = [];
          proxyRes.on('data', (chunk: Buffer) => chunks.push(chunk));
          proxyRes.on('end', () => {
            resolve({
              status: proxyRes.statusCode || 200,
              body: Buffer.concat(chunks),
              contentType: proxyRes.headers['content-type'] || 'application/json',
            });
          });
          proxyRes.on('error', reject);
        });

        proxyReq.on('error', reject);
        proxyReq.write(bodyBuffer);
        proxyReq.end();
      }
    );

    return new Response(new Uint8Array(result.body), {
      status: result.status,
      headers: { 'content-type': result.contentType },
    });
  } catch (err: any) {
    console.error('landscape-proxy error:', err.message);
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Proxy error' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}
