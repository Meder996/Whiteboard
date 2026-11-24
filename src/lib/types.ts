/**
 * Core domain types for the whiteboard.
 *
 * The whole document is a plain JSON object so that it can be persisted,
 * exported, imported and shared without any special casing.
 */

export type ElementType =
  | 'rect'
  | 'ellipse'
  | 'diamond'
  | 'line'
  | 'arrow'
  | 'draw'
  | 'highlighter'
  | 'sticky'
  | 'text'
  | 'image'
  | 'connector';

export type StrokeStyle = 'solid' | 'dashed' | 'dotted';
export type FillStyle = 'solid' | 'none' | 'hachure';
export type FontFamily = 'sans' | 'hand' | 'mono';
export type TextAlign = 'left' | 'center' | 'right';
export type ArrowHead = 'none' | 'arrow';
export type AnchorSide = 'top' | 'right' | 'bottom' | 'left';

export interface Point {
  x: number;
  y: number;
}

export interface TextStyle {
  text: string;
  fontSize: number;
  fontFamily: FontFamily;
  textAlign: TextAlign;
  bold: boolean;
  italic: boolean;
}

export interface ElementBinding {
  elementId: string;
  /** Side of the target element the connector attaches to. */
  side: AnchorSide;
  /** Fraction along that side (0 = start corner, 1 = end corner). */
  offset: number;
}

export interface BaseElement {
  id: string;
  type: ElementType;
  /** Top-left of the axis-aligned bounding box, in board coordinates. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Rotation in radians around the element centre. */
  angle: number;
  opacity: number;
  locked: boolean;
  groupId: string | null;
  stroke: string;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  fill: string;
  fillStyle: FillStyle;
  textStyle?: TextStyle;
  /** Local-space points for freehand and line elements. */
  points?: Point[];
  /** Data URL for image elements. */
  src?: string;
  imageName?: string;
  /** Connector endpoints, resolved on every render. */
  start?: ElementBinding | Point;
  end?: ElementBinding | Point;
  arrowStart?: ArrowHead;
  arrowEnd?: ArrowHead;
  /** Sticky note paper shadow. */
  shadow?: boolean;
  /** Optional paper tint for sticky notes. */
  tint?: string;
  /** Cached thumbnail (never exported). */
  preview?: string | null;
}

export type BoardElement = BaseElement;

export type BackgroundKind = 'grid' | 'dots' | 'plain' | 'lines';

export interface BoardBackground {
  kind: BackgroundKind;
  color: string;
}

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export interface Board {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  elements: BoardElement[];
  background: BoardBackground;
  camera: Camera;
  /** Optional identifier of the template the board started from. */
  templateId?: string | null;
}

export interface BoardMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  elementCount: number;
  preview: string | null;
  background: BoardBackground;
}

export type Tool =
  | 'select'
  | 'hand'
  | 'pen'
  | 'highlighter'
  | 'eraser'
  | 'line'
  | 'arrow'
  | 'rect'
  | 'ellipse'
  | 'diamond'
  | 'sticky'
  | 'text'
  | 'connector';

export const BOARD_SCHEMA_VERSION = 1;

export interface BoardFile {
  /** File format marker so imports can be validated. */
  format: 'whiteboard-studio';
  version: number;
  exportedAt: number;
  board: Board;
}

export interface SharedBoardPayload {
  v: number;
  title: string;
  elements: BoardElement[];
  background: BoardBackground;
  permission: 'view' | 'comment' | 'edit';
  sharedAt: number;
}

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  category: 'brainstorm' | 'process' | 'planning' | 'teaching' | 'meeting';
  build: () => BoardElement[];
}
