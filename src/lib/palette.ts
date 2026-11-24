import type { BoardBackground, FontFamily, StrokeStyle, Tool } from './types';

export const STROKE_COLORS = [
  '#1e293b',
  '#475569',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#6366f1',
  '#a855f7',
  '#ec4899',
  '#ffffff',
];

export const FILL_COLORS = [
  'transparent',
  '#ffffff',
  '#f1f5f9',
  '#fee2e2',
  '#ffedd5',
  '#fef9c3',
  '#dcfce7',
  '#ccfbf1',
  '#dbeafe',
  '#e0e7ff',
  '#f3e8ff',
  '#fce7f3',
];

export const STICKY_COLORS = [
  { name: 'Sunshine', value: '#fde68a' },
  { name: 'Peach', value: '#fed7aa' },
  { name: 'Blush', value: '#fecdd3' },
  { name: 'Mint', value: '#bbf7d0' },
  { name: 'Sky', value: '#bae6fd' },
  { name: 'Lavender', value: '#ddd6fe' },
  { name: 'Paper', value: '#f8fafc' },
  { name: 'Graphite', value: '#cbd5e1' },
];

export const STICKY_TEXT_COLORS = ['#1f2937', '#7c2d12', '#831843', '#14532d', '#0c4a6e', '#4c1d95', '#334155'];

export const BOARD_BACKGROUNDS: { id: string; label: string; background: BoardBackground }[] = [
  { id: 'grid-light', label: 'Grid', background: { kind: 'grid', color: '#f8fafc' } },
  { id: 'dots-light', label: 'Dots', background: { kind: 'dots', color: '#f8fafc' } },
  { id: 'plain-light', label: 'Paper', background: { kind: 'plain', color: '#ffffff' } },
  { id: 'lines-light', label: 'Ruled', background: { kind: 'lines', color: '#fdfdfd' } },
  { id: 'grid-warm', label: 'Warm', background: { kind: 'grid', color: '#fdf8f3' } },
  { id: 'grid-dark', label: 'Midnight', background: { kind: 'grid', color: '#0f172a' } },
  { id: 'plain-mint', label: 'Mint', background: { kind: 'dots', color: '#f2fbf6' } },
  { id: 'plain-sand', label: 'Sand', background: { kind: 'plain', color: '#f6f1e7' } },
];

export const STROKE_WIDTHS = [
  { label: 'Thin', value: 1 },
  { label: 'Medium', value: 2 },
  { label: 'Bold', value: 4 },
  { label: 'Heavy', value: 8 },
];

export const FONT_FAMILIES: { id: FontFamily; label: string; className: string }[] = [
  { id: 'sans', label: 'Clean', className: 'font-sans' },
  { id: 'hand', label: 'Handwritten', className: 'font-hand' },
  { id: 'mono', label: 'Mono', className: 'font-mono' },
];

export const FONT_SIZES = [12, 16, 20, 24, 32, 40, 56];

export const LINE_STYLES: { id: StrokeStyle; label: string }[] = [
  { id: 'solid', label: 'Solid' },
  { id: 'dashed', label: 'Dashed' },
  { id: 'dotted', label: 'Dotted' },
];

export interface ToolStyle {
  stroke: string;
  fill: string;
  fillStyle: 'solid' | 'none' | 'hachure';
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  opacity: number;
  fontSize: number;
  fontFamily: FontFamily;
  stickyColor: string;
}

export const DEFAULT_STYLE: ToolStyle = {
  stroke: '#1e293b',
  fill: '#dbeafe',
  fillStyle: 'solid',
  strokeWidth: 2,
  strokeStyle: 'solid',
  opacity: 1,
  fontSize: 20,
  fontFamily: 'sans',
  stickyColor: '#fde68a',
};

export const TOOL_HINTS: Record<Tool | 'eraser', string> = {
  select: 'Click to select · drag to marquee · Shift for multi-select',
  hand: 'Drag to pan the canvas',
  pen: 'Draw with a mouse, stylus, or finger',
  highlighter: 'Highlight over your ideas',
  eraser: 'Click or drag across objects to erase',
  line: 'Drag to draw a line',
  arrow: 'Drag to draw an arrow',
  rect: 'Drag to draw a rectangle',
  ellipse: 'Drag to draw an ellipse',
  diamond: 'Drag to draw a decision diamond',
  sticky: 'Click to place a sticky note',
  text: 'Click to add text, or double-click a shape to label it',
  connector: 'Hover a shape to connect, then click a target',
};

export const EMOJI_MAP: Record<string, string> = {
  idea: '💡',
  question: '❓',
  action: '✅',
  risk: '⚠️',
  goal: '🎯',
  win: '🏆',
};
