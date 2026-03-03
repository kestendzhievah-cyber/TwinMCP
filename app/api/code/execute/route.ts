import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/firebase-admin-auth';

let _codeExecutionService: any = null;
async function getCodeExecutionService() {
  if (!_codeExecutionService) {
    const { CodeExecutionService } =
      await import('@/src/services/execution/code-execution.service');
    _codeExecutionService = new CodeExecutionService();
  }
  return _codeExecutionService;
}

const ALLOWED_LANGUAGES = ['javascript', 'typescript', 'python', 'json', 'sql'];
const MAX_CODE_LENGTH = 10000;

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const codeExecutionService = await getCodeExecutionService();
    const { code, language, timeout } = await req.json();

    if (!code || !language) {
      return NextResponse.json({ error: 'Code and language are required' }, { status: 400 });
    }

    if (!ALLOWED_LANGUAGES.includes(language)) {
      return NextResponse.json({ error: `Language not supported. Allowed: ${ALLOWED_LANGUAGES.join(', ')}` }, { status: 400 });
    }

    if (typeof code !== 'string' || code.length > MAX_CODE_LENGTH) {
      return NextResponse.json({ error: `Code must be a string under ${MAX_CODE_LENGTH} characters` }, { status: 400 });
    }

    const result = await codeExecutionService.executeSandboxed(code, language, Math.min(timeout || 5000, 10000));

    return NextResponse.json(result);
  } catch (error: any) {
    logger.error('Error executing code:', error);
    return NextResponse.json({ error: 'Failed to execute code' }, { status: 500 });
  }
}
