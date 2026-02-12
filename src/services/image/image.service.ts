// @ts-ignore - @google-cloud/vision may not be installed
const vision: any = {};
import OpenAI from 'openai';

// Dynamic import for sharp to avoid build-time errors
const getSharp = async () => {
  const sharpModule = await import('sharp');
  return sharpModule.default;
};

export interface ImageAnalysis {
  description: string;
  metadata: ImageMetadata;
  objects?: DetectedObject[];
  text?: string;
}

export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  size: number;
}

export interface DetectedObject {
  name: string;
  confidence: number;
  boundingBox?: any;
}

export class ImageService {
  private visionClient: any = null;
  private openai: OpenAI | null = null;

  // Lazy initialization to avoid build-time errors
  private getVisionClient(): any {
    if (!this.visionClient) {
      this.visionClient = new vision.ImageAnnotatorClient();
    }
    return this.visionClient;
  }

  private getOpenAI(): OpenAI {
    if (!this.openai) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY environment variable is required');
      }
      this.openai = new OpenAI({ apiKey });
    }
    return this.openai;
  }

  async analyze(imageBuffer: Buffer): Promise<ImageAnalysis> {
    const sharp = await getSharp();
    const optimized = await sharp(imageBuffer)
      .resize(1024, 1024, { fit: 'inside' })
      .jpeg({ quality: 85 })
      .toBuffer();

    const base64 = optimized.toString('base64');

    const response = await this.getOpenAI().chat.completions.create({
      model: 'gpt-4-vision-preview',
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Analyze this image and describe what you see in detail.'
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${base64}`
            }
          }
        ]
      }],
      max_tokens: 500
    });

    const metadata = await this.extractMetadata(imageBuffer);
    const objects = await this.detectObjects(imageBuffer);
    const text = await this.extractText(imageBuffer);

    return {
      description: response.choices[0].message.content ?? '',
      metadata,
      objects,
      text
    };
  }

  async extractText(imageBuffer: Buffer): Promise<string> {
    const [result] = await this.getVisionClient().textDetection(imageBuffer);
    return result.fullTextAnnotation?.text ?? '';
  }

  async detectObjects(imageBuffer: Buffer): Promise<DetectedObject[]> {
    const [result] = await this.getVisionClient().objectLocalization(imageBuffer);

    return result.localizedObjectAnnotations?.map((obj: any) => ({
      name: obj.name ?? '',
      confidence: obj.score ?? 0,
      boundingBox: obj.boundingPoly
    })) ?? [];
  }

  async extractMetadata(imageBuffer: Buffer): Promise<ImageMetadata> {
    const sharp = await getSharp();
    const metadata = await sharp(imageBuffer).metadata();

    return {
      width: metadata.width ?? 0,
      height: metadata.height ?? 0,
      format: metadata.format ?? 'unknown',
      size: imageBuffer.length
    };
  }

  async optimizeImage(imageBuffer: Buffer, maxWidth: number = 1920): Promise<Buffer> {
    const sharp = await getSharp();
    return await sharp(imageBuffer)
      .resize(maxWidth, null, { 
        fit: 'inside',
        withoutEnlargement: true 
      })
      .jpeg({ quality: 85, progressive: true })
      .toBuffer();
  }

  async generateThumbnail(imageBuffer: Buffer, size: number = 200): Promise<Buffer> {
    const sharp = await getSharp();
    return await sharp(imageBuffer)
      .resize(size, size, { fit: 'cover' })
      .jpeg({ quality: 80 })
      .toBuffer();
  }
}
