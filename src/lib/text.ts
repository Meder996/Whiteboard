import type { FontFamily, TextStyle } from './types';

export const FONT_STACKS: Record<FontFamily, string> = {
  sans: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  hand: '"Kalam", "Comic Sans MS", "Segoe Print", cursive',
  mono: 'ui-monospace, "SFMono-Regular", "JetBrains Mono", Menlo, monospace',
};

export const LINE_HEIGHT_RATIO = 1.3;

let measureContext: CanvasRenderingContext2D | null = null;
const measureCache = new Map<string, number>();

let contextUnavailable = false;

const getContext = () => {
  if (typeof document === 'undefined' || contextUnavailable) return null;
  if (!measureContext) {
    try {
      const canvas = document.createElement('canvas');
      measureContext = canvas.getContext('2d');
    } catch {
      measureContext = null;
    }
    // jsdom and some locked-down browsers throw or return null here; fall back
    // to an average-glyph estimate rather than spamming the console.
    if (!measureContext) contextUnavailable = true;
  }
  return measureContext;
};

const estimateWidth = (text: string, fontSize: number, fontFamily: FontFamily, bold: boolean) =>
  text.length * fontSize * (fontFamily === 'mono' ? 0.6 : fontFamily === 'hand' ? 0.52 : 0.54) * (bold ? 1.03 : 1);

export const measureText = (
  text: string,
  fontSize: number,
  fontFamily: FontFamily,
  bold = false,
  italic = false,
): number => {
  const key = `${fontFamily}|${fontSize}|${bold ? 1 : 0}${italic ? 1 : 0}|${text}`;
  const cached = measureCache.get(key);
  if (cached !== undefined) return cached;
  const context = getContext();
  let width: number;
  if (context) {
    try {
      context.font = `${italic ? 'italic ' : ''}${bold ? '700 ' : '400 '}${fontSize}px ${FONT_STACKS[fontFamily]}`;
      width = context.measureText(text).width;
    } catch {
      contextUnavailable = true;
      width = estimateWidth(text, fontSize, fontFamily, bold);
    }
  } else {
    width = estimateWidth(text, fontSize, fontFamily, bold);
  }
  if (measureCache.size > 4000) measureCache.clear();
  measureCache.set(key, width);
  return width;
};

export interface TextLayout {
  lines: string[];
  lineHeight: number;
  width: number;
  height: number;
}

/**
 * Greedy word-wrap that also respects explicit newlines and breaks
 * over-long single words.
 */
export const layoutText = (
  style: Pick<TextStyle, 'text' | 'fontSize' | 'fontFamily' | 'bold' | 'italic'>,
  maxWidth: number,
): TextLayout => {
  const fontSize = style.fontSize || 20;
  const lineHeight = fontSize * LINE_HEIGHT_RATIO;
  const width = Math.max(maxWidth, fontSize);
  const lines: string[] = [];

  for (const paragraph of (style.text ?? '').split('\n')) {
    if (!paragraph) {
      lines.push('');
      continue;
    }
    const words = paragraph.split(/(\s+)/).filter((word) => word !== '');
    let current = '';
    for (const word of words) {
      const candidate = current + word;
      if (measureText(candidate.trimEnd(), fontSize, style.fontFamily, style.bold, style.italic) > width && current) {
        lines.push(current.trimEnd());
        current = word.trimStart();
      } else {
        current = candidate;
      }
      // Break a single very long word.
      while (measureText(current.trimEnd(), fontSize, style.fontFamily, style.bold, style.italic) > width && current.length > 1) {
        let fit = current.length;
        while (
          fit > 1 &&
          measureText(current.slice(0, fit), fontSize, style.fontFamily, style.bold, style.italic) > width
        ) {
          fit -= 1;
        }
        lines.push(current.slice(0, fit));
        current = current.slice(fit);
      }
    }
    lines.push(current.trimEnd());
  }

  if (!lines.length) lines.push('');
  const widest = lines.reduce(
    (max, line) => Math.max(max, measureText(line, fontSize, style.fontFamily, style.bold, style.italic)),
    0,
  );

  return { lines, lineHeight, width: Math.min(widest, width), height: lines.length * lineHeight };
};

export const PADDING: Record<string, number> = {
  sticky: 18,
  text: 4,
  shape: 12,
};

export const textPaddingFor = (type: string) => PADDING[type] ?? 12;
