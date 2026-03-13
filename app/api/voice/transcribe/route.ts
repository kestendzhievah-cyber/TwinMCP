import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/firebase-admin-auth';
import { AuthenticationError } from '@/lib/errors';
import { handleApiError } from '@/lib/api-error-handler';

const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25MB (Whisper limit)

let _voiceService: any = null;
async function getVoiceService() {
  if (!_voiceService) {
    const { VoiceService } = await import('@/src/services/voice/voice.service');
    _voiceService = new VoiceService();
  }
  return _voiceService;
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req.headers.get('authorization'));
    if (!userId) {
      throw new AuthenticationError();
    }

    const voiceService = await getVoiceService();
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      return NextResponse.json({ error: 'Audio file is required' }, { status: 400 });
    }

    if (audioFile.size > MAX_AUDIO_SIZE) {
      return NextResponse.json({ error: 'Audio file must be under 25MB' }, { status: 400 });
    }

    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
    const transcription = await voiceService.transcribe(audioBuffer);

    return NextResponse.json({ transcription });
  } catch (error) {
    return handleApiError(error, 'VoiceTranscribe');
  }
}
