import { NextRequest, NextResponse } from 'next/server';

// Extend NextRequest to include user property (assuming auth middleware like NextAuth)
interface AuthenticatedRequest extends NextRequest {
  user?: { id: string };
}

// Assuming authentication middleware sets req.user
// For example, using NextAuth.js or similar

export async function GET(req: AuthenticatedRequest) {
  // Extract userId from query or params
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId');

  if (!req.user || !userId || userId !== req.user.id) {
    return NextResponse.json(
      { error: 'Unauthorized' }, { status: 401 }
    );
  }

  // Your chat logic here
  return NextResponse.json({ message: 'Chat endpoint working' });
}

export async function POST(req: AuthenticatedRequest) {
  // Similar check for POST
  const body = await req.json();
  const userId = body.userId;

  if (!req.user || !userId || userId !== req.user.id) {
    return NextResponse.json(
      { error: 'Unauthorized' }, { status: 401 }
    );
  }

  // Handle chat creation or message
  return NextResponse.json({ success: true });
}
