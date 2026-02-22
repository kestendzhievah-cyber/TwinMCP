import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';

let _codeExecutionService: any = null;
async function getCodeExecutionService() {
  if (!_codeExecutionService) {
    const { CodeExecutionService } = await import('@/src/services/execution/code-execution.service');
    _codeExecutionService = new CodeExecutionService();
  }
  return _codeExecutionService;
}

export async function POST(req: NextRequest) {
  try {
    const codeExecutionService = await getCodeExecutionService();
    const { code, language, timeout } = await req.json();

    if (!code || !language) {
      return NextResponse.json(
        { error: 'Code and language are required' },
        { status: 400 }
      );
    }

    const result = await codeExecutionService.executeSandboxed(
      code,
      language,
      timeout || 5000
    );

    return NextResponse.json(result);
  } catch (error: any) {
    logger.error('Error executing code:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to execute code' },
      { status: 500 }
    );
  }
}
