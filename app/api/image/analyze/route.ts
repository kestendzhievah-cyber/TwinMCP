import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/firebase-admin-auth';

let _imageService: any = null;
async function getImageService() {
  if (!_imageService) {
    const { ImageService } = await import('@/src/services/image/image.service');
    _imageService = new ImageService();
  }
  return _imageService;
}

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const imageService = await getImageService();
    const formData = await req.formData();
    const imageFile = formData.get('image') as File;

    if (!imageFile) {
      return NextResponse.json({ error: 'Image file is required' }, { status: 400 });
    }

    if (imageFile.size > MAX_IMAGE_SIZE) {
      return NextResponse.json({ error: 'Image must be under 10MB' }, { status: 400 });
    }

    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
    const analysis = await imageService.analyze(imageBuffer);

    return NextResponse.json(analysis);
  } catch (error: any) {
    logger.error('Error analyzing image:', error);
    return NextResponse.json(
      { error: 'Failed to analyze image' },
      { status: 500 }
    );
  }
}
