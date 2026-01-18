import { NextRequest, NextResponse } from 'next/server';
import { VoiceService } from '@/src/services/voice/voice.service';

const voiceService = new VoiceService();

export async function POST(req: NextRequest) {
  try {
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
    console.error('Error transcribing audio:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to transcribe audio' },
      { status: 500 }
    );
  }
}
