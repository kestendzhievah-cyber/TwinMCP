import { SpeechClient } from '@google-cloud/speech';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import OpenAI from 'openai';

export interface TranscriptionResult {
  text: string;
  confidence?: number;
  language?: string;
}

export interface SynthesisOptions {
  voice?: string;
  languageCode?: string;
  speakingRate?: number;
  pitch?: number;
}

export class VoiceService {
  private speechClient: SpeechClient;
  private ttsClient: TextToSpeechClient;
  private openai: OpenAI;

  constructor() {
    this.speechClient = new SpeechClient();
    this.ttsClient = new TextToSpeechClient();
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async transcribe(audioBuffer: Buffer): Promise<string> {
    const file = new File([audioBuffer], 'audio.mp3', { type: 'audio/mp3' });

    const response = await this.openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'en'
    });

    return response.text;
  }

  async synthesize(text: string, options: SynthesisOptions = {}): Promise<Buffer> {
    const [response] = await this.ttsClient.synthesizeSpeech({
      input: { text },
      voice: {
        languageCode: options.languageCode || 'en-US',
        name: options.voice || 'en-US-Neural2-F'
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: options.speakingRate || 1.0,
        pitch: options.pitch || 0
      }
    });

    return Buffer.from(response.audioContent as Uint8Array);
  }

  async *streamTranscribe(audioStream: ReadableStream): AsyncGenerator<string> {
    const stream = this.speechClient.streamingRecognize({
      config: {
        encoding: 'LINEAR16',
        sampleRateHertz: 16000,
        languageCode: 'en-US',
        enableAutomaticPunctuation: true
      },
      interimResults: true
    });

    const reader = audioStream.getReader();
    
    (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          stream.write(value);
        }
        stream.end();
      } catch (error) {
        console.error('Stream error:', error);
      }
    })();

    for await (const response of stream) {
      if (response.results && response.results[0]?.alternatives?.[0]) {
        yield response.results[0].alternatives[0].transcript || '';
      }
    }
  }

  async detectLanguage(audioBuffer: Buffer): Promise<string> {
    const [response] = await this.speechClient.recognize({
      audio: { content: audioBuffer.toString('base64') },
      config: {
        encoding: 'LINEAR16',
        sampleRateHertz: 16000,
        languageCode: 'auto'
      }
    });

    return response.results?.[0]?.languageCode || 'en-US';
  }
}
