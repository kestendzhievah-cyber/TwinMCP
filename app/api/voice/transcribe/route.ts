import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';

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
    const voiceService = await getVoiceService();
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      return NextResponse.json(
        { error: 'Audio file is required' },
        { status: 400 }
      );
    }

    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
    const transcription = await voiceService.transcribe(audioBuffer);

    return NextResponse.json({ transcription });
  } catch (error: any) {
    logger.error('Error transcribing audio:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to transcribe audio' },
      { status: 500 }
    );
  }
}
