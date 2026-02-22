import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';

let _imageService: any = null;
async function getImageService() {
  if (!_imageService) {
    const { ImageService } = await import('@/src/services/image/image.service');
    _imageService = new ImageService();
  }
  return _imageService;
}

export async function POST(req: NextRequest) {
  try {
    const imageService = await getImageService();
    const formData = await req.formData();
    const imageFile = formData.get('image') as File;

    if (!imageFile) {
      return NextResponse.json(
        { error: 'Image file is required' },
        { status: 400 }
      );
    }

    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
    const analysis = await imageService.analyze(imageBuffer);

    return NextResponse.json(analysis);
  } catch (error: any) {
    logger.error('Error analyzing image:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to analyze image' },
      { status: 500 }
    );
  }
}
