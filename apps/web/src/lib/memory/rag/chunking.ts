export type ChunkMetadata = {
  name?: string;
  type: string;
  parent?: string[];
  docs?: string;
  language: string;
  [key: string]: unknown;
};

export type Chunk = {
  content: string;
  filePath: string;
  startLine: number;
  endLine: number;
  metadata: ChunkMetadata;
};

export type ContextualChunk = Chunk & {
  context: string;
  contextualContent: string;
};

const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '': 'javascript',
  '.jsx': 'javascript',
  '.py': 'python',
  '.rb': 'ruby',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.c': 'c',
  '.cpp': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp',
  '.cs': 'csharp',
  '.php': 'php',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.scala': 'scala',
  '.vue': 'vue',
  '.svelte': 'svelte',
  '.md': 'markdown',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'toml',
  '.xml': 'xml',
  '.html': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.less': 'less',
  '.sql': 'sql',
  '.sh': 'bash',
  '.bash': 'bash',
  '.zsh': 'zsh',
};

export function getLanguageFromExtension(extension: string): string | null {
  return EXTENSION_TO_LANGUAGE[extension.toLowerCase()] || null;
}

export function isCodeFile(extension: string): boolean {
  return extension.toLowerCase() in EXTENSION_TO_LANGUAGE;
}

const DEFAULT_CHUNK_SIZE = 1500;
const DEFAULT_OVERLAP = 200;

export type ChunkingOptions = {
  maxChunkSize?: number;
  overlap?: number;
};

export function chunkText(
  content: string,
  filePath: string,
  options: ChunkingOptions = {}
): Chunk[] {
  const { maxChunkSize = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_OVERLAP } = options;

  const extension = filePath.substring(filePath.lastIndexOf('.'));
  const language = getLanguageFromExtension(extension) || 'text';

  const lines = content.split('\n');
  const chunks: Chunk[] = [];

  let currentChunk: string[] = [];
  let currentSize = 0;
  let startLine = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const lineSize = line.length + 1;

    if (currentSize + lineSize > maxChunkSize && currentChunk.length > 0) {
      chunks.push({
        content: currentChunk.join('\n'),
        filePath,
        startLine,
        endLine: startLine + currentChunk.length - 1,
        metadata: {
          type: 'chunk',
          language,
        },
      });

      const overlapLines = Math.ceil(overlap / (maxChunkSize / currentChunk.length));
      const keepLines = Math.min(overlapLines, currentChunk.length);
      currentChunk = currentChunk.slice(-keepLines);
      startLine = startLine + currentChunk.length - keepLines;
      currentSize = currentChunk.join('\n').length;
    }

    currentChunk.push(line);
    currentSize += lineSize;
  }

  if (currentChunk.length > 0) {
    chunks.push({
      content: currentChunk.join('\n'),
      filePath,
      startLine,
      endLine: startLine + currentChunk.length - 1,
      metadata: {
        type: 'chunk',
        language,
      },
    });
  }

  return chunks;
}

export function createContextualChunk(chunk: Chunk, context?: string): ContextualChunk {
  const fallbackContext = buildFallbackContext(chunk);
  const finalContext = context || fallbackContext;

  return {
    ...chunk,
    context: finalContext,
    contextualContent: buildContextualContent(chunk, finalContext),
  };
}

function buildFallbackContext(chunk: Chunk): string {
  const parts: string[] = [];

  if (chunk.metadata.name) {
    parts.push(`Defines ${chunk.metadata.type} "${chunk.metadata.name}"`);
  } else {
    parts.push(`Contains ${chunk.metadata.type} code`);
  }

  if (chunk.metadata.parent?.length) {
    parts.push(`inside ${chunk.metadata.parent.join(' > ')}`);
  }

  parts.push(`in ${chunk.filePath}`);

  return parts.join(' ');
}

function buildContextualContent(chunk: Chunk, context: string): string {
  const header = [
    `File: ${chunk.filePath}`,
    chunk.metadata.parent?.length ? `Scope: ${chunk.metadata.parent.join(' > ')}` : null,
    chunk.metadata.name ? `Name: ${chunk.metadata.name}` : null,
    `Type: ${chunk.metadata.type}`,
    '',
    `Description: ${context}`,
    '',
  ]
    .filter(Boolean)
    .join('\n');

  return `${header}\n${chunk.content}`;
}
