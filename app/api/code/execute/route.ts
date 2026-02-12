import { NextRequest, NextResponse } from 'next/server';
import { CodeExecutionService } from '@/src/services/execution/code-execution.service';

const codeExecutionService = new CodeExecutionService();

export async function POST(req: NextRequest) {
  try {
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
    console.error('Error executing code:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to execute code' },
      { status: 500 }
    );
  }
}
