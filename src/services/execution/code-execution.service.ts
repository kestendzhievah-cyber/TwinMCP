import { VM } from 'vm2';
import Docker from 'dockerode';

export interface ExecutionResult {
  success: boolean;
  output?: string;
  result?: any;
  error?: string;
  executionTime: number;
}

export class CodeExecutionService {
  private docker: Docker;
  private output: string[];

  constructor() {
    this.docker = new Docker();
    this.output = [];
  }

  async executeSandboxed(
    code: string,
    language: string,
    timeout: number = 5000
  ): Promise<ExecutionResult> {
    if (language === 'javascript' || language === 'typescript') {
      return await this.executeInVM(code, timeout);
    } else {
      return await this.executeInDocker(code, language, timeout);
    }
  }

  private async executeInVM(
    code: string,
    timeout: number
  ): Promise<ExecutionResult> {
    const output: string[] = [];
    const startTime = Date.now();

    const vm = new VM({
      timeout,
      sandbox: {
        console: {
          log: (...args: any[]) => {
            output.push(args.join(' '));
          }
        }
      }
    });

    try {
      const result = vm.run(code);
      const executionTime = Date.now() - startTime;

      return {
        success: true,
        output: output.join('\n'),
        result,
        executionTime
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      
      return {
        success: false,
        error: error.message,
        output: output.join('\n'),
        executionTime
      };
    }
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
        error: error.message,
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
