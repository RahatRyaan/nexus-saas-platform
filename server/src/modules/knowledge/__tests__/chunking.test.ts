describe('Knowledge Base Chunking Tests', () => {
  function chunkText(text: string, maxChunkSize = 800, overlap = 100): string[] {
    const words = text.split(/\s+/);
    const chunks: string[] = [];
    let currentChunk: string[] = [];
    let currentLength = 0;

    for (const word of words) {
      currentChunk.push(word);
      currentLength += word.length + 1;

      if (currentLength >= maxChunkSize) {
        chunks.push(currentChunk.join(' '));
        const overlapWords = Math.floor(overlap / 6);
        currentChunk = currentChunk.slice(-overlapWords);
        currentLength = currentChunk.join(' ').length;
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '));
    }

    return chunks.filter((c) => c.trim().length > 20);
  }

  it('should chunk long documents with reasonable chunk sizes', () => {
    const paragraph = 'This is a sample document for testing the knowledge base semantic search chunking logic. ';
    const longText = paragraph.repeat(50); // ~4500 characters

    const chunks = chunkText(longText, 800, 100);
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk) => {
      expect(chunk.length).toBeGreaterThan(20);
    });
  });

  it('should return empty chunks for very short text below threshold', () => {
    const shortText = 'Hi';
    const chunks = chunkText(shortText);
    expect(chunks.length).toBe(0);
  });
});
