/**
 * Next.js API Route — Document Upload Proxy
 * Handles multipart/form-data file uploads and forwards them to the Express backend.
 * Using an explicit API route instead of the next.config.js rewrite avoids
 * proxy-level issues with large multipart bodies through the gateway.
 */
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Disable default body parser so we can stream FormData
export const config = {
  api: { bodyParser: false },
};

const BACKEND_URL = 'http://localhost:3001';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const formData = await req.formData();

    // Re-build form data to forward to backend
    const backendForm = new FormData();
    for (const [key, value] of formData.entries()) {
      if (value instanceof Blob) {
        // Preserve file name and type
        const file = value as File;
        backendForm.append(key, file, file.name || 'upload');
      } else {
        backendForm.append(key, value as string);
      }
    }

    const backendRes = await fetch(`${BACKEND_URL}/api/documents/upload`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        // Do NOT set Content-Type — fetch sets it automatically with boundary
      },
      body: backendForm,
    });

    const data = await backendRes.json();
    return NextResponse.json(data, { status: backendRes.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[documents/upload] proxy error:', message);
    return NextResponse.json({ error: 'Upload proxy failed: ' + message }, { status: 500 });
  }
}
