import type { ReactNode } from 'react';
import { anchorPoint, elementCenter, rotatePoint, smoothPath } from './geometry';
import { FONT_STACKS, LINE_HEIGHT_RATIO, layoutText, measureText, textPaddingFor } from './text';
import type { BaseElement, BoardElement, ElementBinding, Point, TextStyle } from './types';

export const DASH_ARRAYS: Record<string, string | undefined> = {
  solid: undefined,
  dashed: '10 7',
  dotted: '1.5 6',
};

const isBinding = (value: unknown): value is ElementBinding =>
  Boolean(value && typeof value === 'object' && 'elementId' in (value as object));

export const resolveEndpoint = (
  endpoint: ElementBinding | Point | undefined,
  fallback: Point,
  elements: BoardElement[],
): Point => {
  if (!endpoint) return fallback;
  if (isBinding(endpoint)) {
    const target = elements.find((element) => element.id === endpoint.elementId);
    if (!target) return fallback;
    return anchorPoint(target, endpoint.side, endpoint.offset);
  }
  return endpoint;
};

/** Smallest possible gap between a connector anchor and an arrow head. */
export const connectorPath = (start: Point, end: Point): string => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return `M ${start.x} ${start.y}`;
  // Orthogonal-free smooth curve with a gentle horizontal lead-out.
  const bend = Math.max(18, Math.min(120, Math.hypot(dx, dy) * 0.35));
  const c1 = { x: start.x + Math.sign(dx || 1) * bend, y: start.y };
  const c2 = { x: end.x - Math.sign(dx || 1) * bend, y: end.y };
  return `M ${start.x} ${start.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${end.x} ${end.y}`;
};

export const arrowHeadPoints = (from: Point, to: Point, size = 12): string => {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const spread = Math.PI / 7;
  const p1 = { x: to.x - size * Math.cos(angle - spread), y: to.y - size * Math.sin(angle - spread) };
  const p2 = { x: to.x - size * Math.cos(angle + spread), y: to.y - size * Math.sin(angle + spread) };
  return `${to.x},${to.y} ${p1.x},${p1.y} ${p2.x},${p2.y}`;
};

export const lineEndPoints = (element: BaseElement): { start: Point; end: Point } => {
  const points = element.points ?? [];
  const start = points[0] ?? { x: 0, y: 0 };
  const end = points[points.length - 1] ?? { x: element.width, y: element.height };
  const center = elementCenter(element);
  return {
    start: rotatePoint({ x: element.x + start.x, y: element.y + start.y }, center, element.angle),
    end: rotatePoint({ x: element.x + end.x, y: element.y + end.y }, center, element.angle),
  };
};

export const elementSvgTransform = (element: BaseElement) => {
  const center = elementCenter(element);
  return `rotate(${(element.angle * 180) / Math.PI} ${center.x} ${center.y})`;
};

const textAnchorFor = (align: TextStyle['textAlign']) =>
  align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start';

export const ElementText = ({ element }: { element: BaseElement }): ReactNode => {
  const style = element.textStyle;
  if (!style || !style.text?.trim()) return null;
  const padding = textPaddingFor(element.type);
  const maxWidth = Math.max(element.width - padding * 2, style.fontSize);
  const layout = layoutText(style, maxWidth);
  const anchor = textAnchorFor(style.textAlign);

  let x = element.x + padding;
  if (style.textAlign === 'center') x = element.x + element.width / 2;
  if (style.textAlign === 'right') x = element.x + element.width - padding;

  let startY: number;
  if (element.type === 'sticky' || element.type === 'text') {
    startY = element.y + padding + style.fontSize;
  } else {
    startY = element.y + element.height / 2 - layout.height / 2 + style.fontSize;
  }

  const color = element.type === 'sticky' ? stickyTextColor(element.fill) : element.stroke;
  const fontFamily = FONT_STACKS[style.fontFamily];
  const common = {
    fill: color,
    fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.bold ? 700 : 400,
    fontStyle: style.italic ? 'italic' : 'normal',
    textAnchor: anchor as 'start' | 'middle' | 'end',
    xmlSpace: 'preserve' as const,
  };

  return (
    <text {...common}>
      {layout.lines.map((line, index) => (
        <tspan key={index} x={x} y={startY + index * style.fontSize * LINE_HEIGHT_RATIO}>
          {line || ' '}
        </tspan>
      ))}
    </text>
  );
};

/** Dark grey is more readable than a very light sticky fill. */
export const stickyTextColor = (fill: string) => {
  const hex = fill.replace('#', '');
  if (hex.length !== 6) return '#1f2937';
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#1f2937' : '#0f172a';
};

const HACHURE_PATTERN_ID = 'hachure';

export const ElementShape = ({ element }: { element: BaseElement }): ReactNode => {
  const { width, height } = element;
  const fill = element.fillStyle === 'none' || element.fill === 'transparent' ? 'none' : element.fill;
  const fillValue = element.fillStyle === 'hachure' ? `url(#${HACHURE_PATTERN_ID})` : fill;

  const common = {
    stroke: element.strokeWidth > 0 ? element.stroke : 'none',
    strokeWidth: element.strokeWidth,
    strokeDasharray: DASH_ARRAYS[element.strokeStyle],
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: fillValue,
  };

  if (element.type === 'rect') {
    const radius = Math.min(16, width / 6, height / 6);
    return <rect x={0} y={0} width={width} height={height} rx={radius} ry={radius} {...common} />;
  }
  if (element.type === 'ellipse') {
    return <ellipse cx={width / 2} cy={height / 2} rx={width / 2} ry={height / 2} {...common} />;
  }
  if (element.type === 'diamond') {
    return (
      <polygon
        points={`${width / 2},0 ${width},${height / 2} ${width / 2},${height} 0,${height / 2}`}
        {...common}
      />
    );
  }
  return null;
};

const PathElement = ({ element }: { element: BaseElement }) => {
  const points = element.points ?? [];
  if (points.length < 2) return null;
  const d = smoothPath(points);
  return (
    <path
      d={d}
      fill="none"
      stroke={element.stroke}
      strokeWidth={element.strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={element.type === 'highlighter' ? 0.45 : 1}
    />
  );
};

export const ArrowHead = ({ from, to, color, size }: { from: Point; to: Point; color: string; size: number }) => {
  if (Math.hypot(to.x - from.x, to.y - from.y) < 1) return null;
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const spread = Math.PI / 7;
  const points = [
    to,
    { x: to.x - size * Math.cos(angle - spread), y: to.y - size * Math.sin(angle - spread) },
    { x: to.x - size * Math.cos(angle + spread), y: to.y - size * Math.sin(angle + spread) },
  ]
    .map((point) => `${point.x},${point.y}`)
    .join(' ');
  return <polygon points={points} fill={color} stroke="none" />;
};

const ConnectorElement = ({
  element,
  elements,
}: {
  element: BaseElement;
  elements: BoardElement[];
}) => {
  const start = resolveEndpoint(element.start, { x: element.x, y: element.y }, elements);
  const end = resolveEndpoint(
    element.end,
    { x: element.x + element.width, y: element.y + element.height },
    elements,
  );
  const d = connectorPath(start, end);
  const headSize = Math.max(10, element.strokeWidth * 3.4);
  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke={element.stroke}
        strokeWidth={element.strokeWidth}
        strokeDasharray={DASH_ARRAYS[element.strokeStyle]}
        strokeLinecap="round"
      />
      {element.arrowEnd === 'arrow' ? (
        <ArrowHead from={start} to={end} color={element.stroke} size={headSize} />
      ) : null}
      {element.arrowStart === 'arrow' ? (
        <ArrowHead from={end} to={start} color={element.stroke} size={headSize} />
      ) : null}
    </g>
  );
};

/** A single element, positioned in board space. */
export const RenderElement = ({
  element,
  elements,
}: {
  element: BaseElement;
  elements: BoardElement[];
}): ReactNode => {
  if (element.type === 'connector') {
    return <ConnectorElement element={element} elements={elements} />;
  }

  if (element.type === 'line' || element.type === 'arrow') {
    const { start, end } = lineEndPoints(element);
    const headSize = Math.max(10, element.strokeWidth * 3.4);
    return (
      <g>
        <line
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
          stroke={element.stroke}
          strokeWidth={element.strokeWidth}
          strokeDasharray={DASH_ARRAYS[element.strokeStyle]}
          strokeLinecap="round"
        />
        {element.type === 'arrow' || element.arrowEnd === 'arrow' ? (
          <ArrowHead from={start} to={end} color={element.stroke} size={headSize} />
        ) : null}
        {element.arrowStart === 'arrow' ? (
          <ArrowHead from={end} to={start} color={element.stroke} size={headSize} />
        ) : null}
      </g>
    );
  }

  if (element.type === 'draw' || element.type === 'highlighter') {
    return (
      <g transform={elementSvgTransform(element)} opacity={element.opacity}>
        <g transform={`translate(${element.x} ${element.y})`}>
          <PathElement element={element} />
        </g>
      </g>
    );
  }

  return (
    <g transform={elementSvgTransform(element)} opacity={element.opacity}>
      <g transform={`translate(${element.x} ${element.y})`}>
        {element.type === 'image' && element.src ? (
          <image
            href={element.src}
            width={element.width}
            height={element.height}
            preserveAspectRatio="xMidYMid slice"
          />
        ) : element.type === 'sticky' ? (
          <>
            {element.shadow !== false && (
              <rect
                x={3}
                y={4}
                width={widthOf(element)}
                height={heightOf(element)}
                rx={2}
                fill="rgba(15,23,42,.10)"
              />
            )}
            <rect
              x={0}
              y={0}
              width={widthOf(element)}
              height={heightOf(element)}
              fill={element.fill}
              stroke={element.strokeWidth > 0 ? element.stroke : 'none'}
              strokeWidth={element.strokeWidth}
            />
          </>
        ) : element.type === 'text' ? null : (
          <ElementShape element={element} />
        )}
      </g>
      {element.type !== 'image' ? <ElementText element={element} /> : null}
    </g>
  );
};

const widthOf = (element: BaseElement) => element.width;
const heightOf = (element: BaseElement) => element.height;

export const SvgDefs = ({ stroke = '#475569' }: { stroke?: string }) => (
  <defs>
    <pattern id={HACHURE_PATTERN_ID} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="8" stroke={stroke} strokeWidth="1.5" opacity="0.55" />
    </pattern>
  </defs>
);

/** Full static board rendering (used by tests and print). */
export const BoardSvg = ({
  elements,
  width,
  height,
  viewBox,
  background,
  className,
}: {
  elements: BoardElement[];
  width: number;
  height: number;
  viewBox?: string;
  background?: { kind: string; color: string };
  className?: string;
}) => (
  <svg width={width} height={height} viewBox={viewBox} className={className} xmlns="http://www.w3.org/2000/svg">
    {background ? <rect x={0} y={0} width="100%" height="100%" fill={background.color} /> : null}
    <SvgDefs />
    {elements.map((element) => (
      <RenderElement key={element.id} element={element} elements={elements} />
    ))}
  </svg>
);

/** Text width helper exposed for tests and layout nudges. */
export const measureElementText = (element: BaseElement) => {
  if (!element.textStyle) return 0;
  return measureText(
    element.textStyle.text,
    element.textStyle.fontSize,
    element.textStyle.fontFamily,
    element.textStyle.bold,
    element.textStyle.italic,
  );
};
