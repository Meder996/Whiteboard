import { DEFAULT_STYLE, type ToolStyle } from './palette';
import { uid } from './geometry';
import type {
  BaseElement,
  BoardElement,
  ElementBinding,
  ElementType,
  FontFamily,
  StrokeStyle,
  TextAlign,
} from './types';

export interface ElementOptions extends Partial<BaseElement> {
  text?: string;
}

export const createElement = (
  type: ElementType,
  x: number,
  y: number,
  width: number,
  height: number,
  options: ElementOptions = {},
  style: ToolStyle = DEFAULT_STYLE,
): BoardElement => {
  const {
    text,
    textStyle,
    stroke = style.stroke,
    fill = style.fill,
    fillStyle = style.fillStyle,
    strokeWidth = style.strokeWidth,
    strokeStyle = style.strokeStyle,
    opacity = style.opacity,
    ...rest
  } = options;

  const hasText = ['sticky', 'text', 'rect', 'ellipse', 'diamond'].includes(type);
  const fontSize =
    textStyle?.fontSize ??
    (type === 'sticky' ? 20 : type === 'text' ? style.fontSize : Math.max(14, style.fontSize - 2));

  return {
    id: uid(type),
    type,
    x,
    y,
    width,
    height,
    angle: 0,
    opacity,
    locked: false,
    groupId: null,
    stroke,
    strokeWidth,
    strokeStyle,
    fill: type === 'sticky' ? style.stickyColor : fill,
    fillStyle,
    textStyle: hasText
      ? {
          text: text ?? '',
          fontSize,
          fontFamily: (textStyle?.fontFamily ?? style.fontFamily) as FontFamily,
          textAlign: (textStyle?.textAlign ?? (type === 'text' ? 'left' : 'center')) as TextAlign,
          bold: textStyle?.bold ?? false,
          italic: textStyle?.italic ?? false,
        }
      : textStyle,
    points: type === 'draw' || type === 'highlighter' ? [{ x: 0, y: 0 }] : undefined,
    ...rest,
  };
};

export const createSticky = (x: number, y: number, text = '', style: ToolStyle = DEFAULT_STYLE) =>
  createElement('sticky', x, y, 200, 200, {
    text,
    stroke: 'transparent',
    strokeWidth: 1,
    fillStyle: 'solid',
    shadow: true,
  } as ElementOptions, style);

export const createText = (x: number, y: number, text = 'Text', style: ToolStyle = DEFAULT_STYLE) =>
  createElement('text', x, y, 240, Math.max(40, style.fontSize * 1.6), {
    text,
    fill: 'transparent',
    fillStyle: 'none',
    stroke: style.stroke,
    strokeWidth: 0,
    textStyle: {
      text,
      fontSize: style.fontSize,
      fontFamily: style.fontFamily,
      textAlign: 'left',
      bold: false,
      italic: false,
    },
  }, style);

export const binding = (elementId: string, side: ElementBinding['side'], offset = 0.5): ElementBinding => ({
  elementId,
  side,
  offset,
});

export const connectorStroke = (
  start: ElementBinding,
  end: ElementBinding,
  strokeStyle: StrokeStyle = 'solid',
  stroke = '#475569',
): BoardElement => ({
  ...createElement('connector', 0, 0, 0, 0, {
    start,
    end,
    arrowEnd: 'arrow',
    arrowStart: 'none',
    stroke,
    strokeWidth: 2,
    strokeStyle,
    fillStyle: 'none',
    fill: 'transparent',
  }),
});

export const shape = (
  type: ElementType,
  x: number,
  y: number,
  width: number,
  height: number,
  options: ElementOptions & { text?: string } = {},
) => createElement(type, x, y, width, height, options);
