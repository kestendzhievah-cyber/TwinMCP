import { createGzip, createGunzip, createDeflate, createInflate, createBrotliCompress, createBrotliDecompress } from 'zlib';
import { promisify } from 'util';
import { CompressionService, StreamChunk } from '../types/streaming.types';

const pipeline = promisify(require('stream').pipeline);

export class GzipCompressionService implements CompressionService {
  async compress(data: string | Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const gzip = createGzip();
      const chunks: Buffer[] = [];
      
      gzip.on('data', (chunk) => chunks.push(chunk));
      gzip.on('end', () => resolve(Buffer.concat(chunks)));
      gzip.on('error', reject);
      
      gzip.end(typeof data === 'string' ? Buffer.from(data) : data);
    });
  }

  async decompress(data: Buffer): Promise<string | Buffer> {
    return new Promise((resolve, reject) => {
      const gunzip = createGunzip();
      const chunks: Buffer[] = [];
      
      gunzip.on('data', (chunk) => chunks.push(chunk));
      gunzip.on('end', () => resolve(Buffer.concat(chunks)));
      gunzip.on('error', reject);
      
      gunzip.end(data);
    });
  }

  async compressChunks(chunks: StreamChunk[]): Promise<StreamChunk[]> {
    const compressedChunks: StreamChunk[] = [];
    
    for (const chunk of chunks) {
      const compressedData = await this.compress(JSON.stringify(chunk.data));
      
      compressedChunks.push({
        ...chunk,
        data: compressedData,
        size: compressedData.length,
        type: 'content' // Toujours 'content' après compression
      });
    }
    
    return compressedChunks;
  }
}

export class DeflateCompressionService implements CompressionService {
  async compress(data: string | Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const deflate = createDeflate();
      const chunks: Buffer[] = [];
      
      deflate.on('data', (chunk) => chunks.push(chunk));
      deflate.on('end', () => resolve(Buffer.concat(chunks)));
      deflate.on('error', reject);
      
      deflate.end(typeof data === 'string' ? Buffer.from(data) : data);
    });
  }

  async decompress(data: Buffer): Promise<string | Buffer> {
    return new Promise((resolve, reject) => {
      const inflate = createInflate();
      const chunks: Buffer[] = [];
      
      inflate.on('data', (chunk) => chunks.push(chunk));
      inflate.on('end', () => resolve(Buffer.concat(chunks)));
      inflate.on('error', reject);
      
      inflate.end(data);
    });
  }

  async compressChunks(chunks: StreamChunk[]): Promise<StreamChunk[]> {
    const compressedChunks: StreamChunk[] = [];
    
    for (const chunk of chunks) {
      const compressedData = await this.compress(JSON.stringify(chunk.data));
      
      compressedChunks.push({
        ...chunk,
        data: compressedData,
        size: compressedData.length,
        type: 'content'
      });
    }
    
    return compressedChunks;
  }
}

export class BrotliCompressionService implements CompressionService {
  async compress(data: string | Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const brotli = createBrotliCompress();
      const chunks: Buffer[] = [];
      
      brotli.on('data', (chunk) => chunks.push(chunk));
      brotli.on('end', () => resolve(Buffer.concat(chunks)));
      brotli.on('error', reject);
      
      brotli.end(typeof data === 'string' ? Buffer.from(data) : data);
    });
  }

  async decompress(data: Buffer): Promise<string | Buffer> {
    return new Promise((resolve, reject) => {
      const brotli = createBrotliDecompress();
      const chunks: Buffer[] = [];
      
      brotli.on('data', (chunk) => chunks.push(chunk));
      brotli.on('end', () => resolve(Buffer.concat(chunks)));
      brotli.on('error', reject);
      
      brotli.end(data);
    });
  }

  async compressChunks(chunks: StreamChunk[]): Promise<StreamChunk[]> {
    const compressedChunks: StreamChunk[] = [];
    
    for (const chunk of chunks) {
      const compressedData = await this.compress(JSON.stringify(chunk.data));
      
      compressedChunks.push({
        ...chunk,
        data: compressedData,
        size: compressedData.length,
        type: 'content'
      });
    }
    
    return compressedChunks;
  }
}

export class AdaptiveCompressionService implements CompressionService {
  private services: Map<string, CompressionService> = new Map();
  private performanceStats: Map<string, { compressionRatio: number; speed: number }> = new Map();

  constructor() {
    this.services.set('gzip', new GzipCompressionService());
    this.services.set('deflate', new DeflateCompressionService());
    this.services.set('brotli', new BrotliCompressionService());
  }

  async compress(data: string | Buffer): Promise<Buffer> {
    const bestAlgorithm = await this.selectBestAlgorithm(data);
    const service = this.services.get(bestAlgorithm);
    
    if (!service) {
      throw new Error(`Compression service ${bestAlgorithm} not found`);
    }

    const startTime = Date.now();
    const compressed = await service.compress(data);
    const endTime = Date.now();

    // Mise à jour des statistiques de performance
    const compressionRatio = compressed.length / (typeof data === 'string' ? data.length : data.length);
    const speed = (typeof data === 'string' ? data.length : data.length) / (endTime - startTime);

    this.performanceStats.set(bestAlgorithm, {
      compressionRatio,
      speed
    });

    return compressed;
  }

  async decompress(data: Buffer): Promise<string | Buffer> {
    // Tenter de décompresser avec chaque algorithme
    for (const [algorithm, service] of this.services) {
      try {
        return await service.decompress(data);
      } catch (error) {
        // Continuer avec l'algorithme suivant
        continue;
      }
    }
    
    throw new Error('Unable to decompress data with any available algorithm');
  }

  async compressChunks(chunks: StreamChunk[]): Promise<StreamChunk[]> {
    const compressedChunks: StreamChunk[] = [];
    
    for (const chunk of chunks) {
      const compressedData = await this.compress(JSON.stringify(chunk.data));
      
      compressedChunks.push({
        ...chunk,
        data: compressedData,
        size: compressedData.length,
        type: 'content'
      });
    }
    
    return compressedChunks;
  }

  private async selectBestAlgorithm(data: string | Buffer): Promise<string> {
    const dataSize = typeof data === 'string' ? data.length : data.length;
    
    // Pour les petits fichiers, utiliser gzip (rapide)
    if (dataSize < 1024) {
      return 'gzip';
    }
    
    // Pour les fichiers moyens, tester gzip et deflate
    if (dataSize < 10240) {
      const gzipRatio = await this.testCompressionRatio('gzip', data);
      const deflateRatio = await this.testCompressionRatio('deflate', data);
      
      return gzipRatio < deflateRatio ? 'gzip' : 'deflate';
    }
    
    // Pour les gros fichiers, tester tous les algorithmes
    const ratios = new Map<string, number>();
    
    for (const [algorithm, service] of this.services) {
      try {
        ratios.set(algorithm, await this.testCompressionRatio(algorithm, data));
      } catch (error) {
        // Ignorer les algorithmes qui échouent
        continue;
      }
    }
    
    // Sélectionner le meilleur ratio de compression
    let bestAlgorithm = 'gzip';
    let bestRatio = 1;
    
    for (const [algorithm, ratio] of ratios) {
      if (ratio < bestRatio) {
        bestRatio = ratio;
        bestAlgorithm = algorithm;
      }
    }
    
    return bestAlgorithm;
  }

  private async testCompressionRatio(algorithm: string, data: string | Buffer): Promise<number> {
    const service = this.services.get(algorithm);
    if (!service) return 1;

    try {
      const compressed = await service.compress(data);
      const originalSize = typeof data === 'string' ? data.length : data.length;
      return compressed.length / originalSize;
    } catch (error) {
      return 1;
    }
  }

  getPerformanceStats(): Record<string, { compressionRatio: number; speed: number }> {
    return Object.fromEntries(this.performanceStats);
  }
}
