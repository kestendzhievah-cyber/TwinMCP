export class FixedSizeChunker {
  private chunkSize: number;
  private overlap: number;

  constructor(chunkSize: number = 1000, overlap: number = 200) {
    this.chunkSize = chunkSize;
    this.overlap = overlap;
  }

  chunk(content: string): Array<{ content: string; startPosition: number; endPosition: number }> {
    const chunks: Array<{ content: string; startPosition: number; endPosition: number }> = [];
    let position = 0;

    while (position < content.length) {
      const end = Math.min(position + this.chunkSize, content.length);
      chunks.push({
        content: content.slice(position, end),
        startPosition: position,
        endPosition: end
      });
      position += this.chunkSize - this.overlap;
    }

    return chunks;
  }
}
