import Docker from 'dockerode';

export interface ExecutionResult {
  success: boolean;
  output?: string;
  result?: any;
  error?: string;
  executionTime: number;
}

// Maximum code size to prevent resource exhaustion (100KB)
const MAX_CODE_SIZE = 100 * 1024;

// Allowed languages — only these have Docker images configured
const ALLOWED_LANGUAGES = new Set(['javascript', 'typescript', 'python', 'ruby', 'go', 'node']);

export class CodeExecutionService {
  private docker: Docker;

  constructor() {
    this.docker = new Docker();
  }

  async executeSandboxed(
    code: string,
    language: string,
    timeout: number = 5000
  ): Promise<ExecutionResult> {
    // Validate language against whitelist
    if (!ALLOWED_LANGUAGES.has(language)) {
      return {
        success: false,
        error: `Unsupported language: ${language}. Allowed: ${[...ALLOWED_LANGUAGES].join(', ')}`,
        executionTime: 0,
      };
    }

    // Validate code size
    if (code.length > MAX_CODE_SIZE) {
      return {
        success: false,
        error: `Code exceeds maximum size of ${MAX_CODE_SIZE} bytes`,
        executionTime: 0,
      };
    }

    // SECURITY: Always use Docker isolation. Node.js vm module is NOT a
    // security boundary — sandbox escapes are trivial via prototype chain.
    return await this.executeInDocker(code, language, timeout);
  }

  private async executeInDocker(
    code: string,
    language: string,
    timeout: number
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const image = this.getDockerImage(language);
    const fileName = this.getFileName(language);

    try {
      const container = await this.docker.createContainer({
        Image: image,
        Cmd: [this.getRunCommand(language, fileName)],
        HostConfig: {
          Memory: 512 * 1024 * 1024,
          CpuQuota: 50000,
          NetworkMode: 'none'
        },
        AttachStdout: true,
        AttachStderr: true
      });

      await container.putArchive(
        this.createTarball(fileName, code),
        { path: '/app' }
      );

      await container.start();

      const result: any = await Promise.race([
        container.wait(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), timeout)
        )
      ]);

      const logs = await container.logs({
        stdout: true,
        stderr: true
      });

      await container.remove({ force: true });

      const executionTime = Date.now() - startTime;

      return {
        success: result.StatusCode === 0,
        output: logs.toString(),
        executionTime
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      
      return {
        success: false,
        error: error.message === 'Timeout' ? 'Execution timed out' : 'Code execution failed',
        executionTime
      };
    }
  }

  private getDockerImage(language: string): string {
    const images: Record<string, string> = {
      python: 'python:3.11-alpine',
      node: 'node:20-alpine',
      ruby: 'ruby:3.2-alpine',
      go: 'golang:1.21-alpine'
    };

    return images[language] || 'alpine:latest';
  }

  private getFileName(language: string): string {
    const extensions: Record<string, string> = {
      python: 'main.py',
      javascript: 'main.js',
      typescript: 'main.ts',
      ruby: 'main.rb',
      go: 'main.go'
    };

    return extensions[language] || 'main.txt';
  }

  private getRunCommand(language: string, fileName: string): string {
    const commands: Record<string, string> = {
      python: `python /app/${fileName}`,
      javascript: `node /app/${fileName}`,
      ruby: `ruby /app/${fileName}`,
      go: `go run /app/${fileName}`
    };

    return commands[language] || `cat /app/${fileName}`;
  }

  private createTarball(fileName: string, content: string): Buffer {
    const tar = require('tar-stream');
    const pack = tar.pack();

    pack.entry({ name: fileName }, content);
    pack.finalize();

    const chunks: Buffer[] = [];
    pack.on('data', (chunk: Buffer) => chunks.push(chunk));

    return Buffer.concat(chunks);
  }
}
