import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/firebase-admin';
import { createAgent } from '@/lib/agents';
import { canCreateAgent, updateUserAgentsCount } from '@/lib/user-limits';
import QRCode from 'qrcode';

interface CreateChatbotRequest {
  name: string;
  description: string;
  model: string;
  systemPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

interface CreateChatbotResponse {
  success: boolean;
  chatbotId: string;
  publicUrl: string;
  qrCode: string;
  newCount: number;
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.split('Bearer ')[1];
    let decodedToken: any;

    try {
      decodedToken = await auth.verifyIdToken(token);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    const userId = decodedToken.uid;
    const body: CreateChatbotRequest = await request.json();

    // Validate required fields
    if (!body.name || !body.description || !body.model || !body.systemPrompt) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check agent creation limit
    const limitCheck = await canCreateAgent(userId);

    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'LIMIT_REACHED',
          message: limitCheck.message,
          currentCount: limitCheck.currentCount,
          maxAllowed: limitCheck.limit,
          plan: limitCheck.plan,
          suggestedPlan: limitCheck.suggestedUpgrade
        },
        { status: 429 }
      );
    }

    // Create the agent
    const agent = await createAgent(userId, body);

    // Update user agents count
    await updateUserAgentsCount(userId, (limitCheck.currentCount || 0) + 1);

    // Generate QR Code
    const publicUrl = `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}${agent.publicUrl}`;
    const qrCodeDataUrl = await QRCode.toDataURL(publicUrl, {
      width: 200,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    const response: CreateChatbotResponse = {
      success: true,
      chatbotId: agent.id,
      publicUrl,
      qrCode: qrCodeDataUrl,
      newCount: (limitCheck.currentCount || 0) + 1
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error creating chatbot:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
