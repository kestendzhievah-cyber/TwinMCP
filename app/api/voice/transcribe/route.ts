import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/firebase-admin-auth';

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
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
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
  } catch (error: any) {
    logger.error('Error transcribing audio:', error);
    return NextResponse.json(
      { error: 'Failed to transcribe audio' },
      { status: 500 }
    );
  }
}
