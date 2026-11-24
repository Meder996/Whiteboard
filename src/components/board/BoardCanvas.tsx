'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  clamp,
  distance,
  elementRect,
  fromLocal,
  getFitCamera,
  HANDLE_IDS,
  handlePoint,
  MAX_ZOOM,
  MIN_ZOOM,
  normalizeRect,
  rotatePoint,
  screenToWorld,
  selectionBounds,
  resizeElement,
  toLocal,
  uid,
  zoomAtPoint,
  type HandleId,
} from '@/lib/geometry';
import { connectorTargetAt, elementAtPoint, elementsInRect } from '@/lib/hit';
import { snapSelection, type GuideLine } from '@/lib/snap';
import { useEditor } from '@/lib/store';
import { RenderElement, connectorPath, resolveEndpoint } from '@/lib/render';
import { createElement } from '@/lib/elements';
import { CanvasBackground } from './CanvasBackground';
import { TextEditor } from './TextEditor';
import type { BoardElement, ElementBinding, Point } from '@/lib/types';

type Interaction =
  | { kind: 'none' }
  | { kind: 'pan'; start: Point; camera: { x: number; y: number; zoom: number } }
  | { kind: 'marquee'; start: Point; current: Point; additive: boolean }
  | { kind: 'move'; start: Point; ids: string[]; origins: Record<string, { x: number; y: number }> }
  | {
      kind: 'resize';
      handle: HandleId;
      id: string;
      origin: BoardElement;
    }
  | { kind: 'rotate'; id: string; startAngle: number; originAngle: number }
  | {
      kind: 'draw';
      id: string;
      points: Point[];
    }
  | { kind: 'create'; id: string; start: Point; type: 'rect' | 'ellipse' | 'diamond' | 'line' | 'arrow' }
  | { kind: 'erase' }
  | {
      kind: 'connector';
      start: ElementBinding | Point;
      point: Point;
      hoverId: string | null;
      hoverBinding: ElementBinding | null;
    };

interface BoardCanvasProps {
  onZoomChange?: (zoom: number) => void;
}

const GRID_STEP = 24;

export function BoardCanvas({ onZoomChange }: BoardCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const interaction = useRef<Interaction>({ kind: 'none' });
  const [guides, setGuides] = useState<GuideLine[]>([]);
  const [marquee, setMarquee] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [connectorPreview, setConnectorPreview] = useState<{ start: Point; end: Point } | null>(null);
  const [spaceDown, setSpaceDown] = useState(false);
  const [hoverTarget, setHoverTarget] = useState<{ id: string; binding: ElementBinding } | null>(null);

  const elements = useEditor((state) => state.elements);
  const camera = useEditor((state) => state.camera);
  const tool = useEditor((state) => state.tool);
  const selectedIds = useEditor((state) => state.selectedIds);
  const editingId = useEditor((state) => state.editingId);
  const readOnly = useEditor((state) => state.readOnly);
  const background = useEditor((state) => state.background);
  const style = useEditor((state) => state.style);
  const setViewport = useEditor((state) => state.setViewport);

  const selectedElements = useMemo(
    () => elements.filter((element) => selectedIds.includes(element.id)),
    [elements, selectedIds],
  );
  const bounds = useMemo(() => selectionBounds(selectedElements), [selectedElements]);
  const singleSelection = selectedElements.length === 1 ? selectedElements[0] : null;
  const isLockedSelection = selectedElements.length > 0 && selectedElements.every((element) => element.locked);
  const interactive = !readOnly;

  useEffect(() => onZoomChange?.(camera.zoom), [camera.zoom, onZoomChange]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setViewport(width, height);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [setViewport]);

  const getWorld = useCallback(
    (event: { clientX: number; clientY: number }): Point => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return screenToWorld({ x: event.clientX - rect.left, y: event.clientY - rect.top }, camera);
    },
    [camera],
  );

  // Space-to-pan, like most design tools.
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (event.code === 'Space' && !typing) {
        setSpaceDown(true);
        event.preventDefault();
      }
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === 'Space') setSpaceDown(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  // Wheel zoom (ctrl/cmd or trackpad pinch) and two-finger pan.
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = node.getBoundingClientRect();
      const pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      const state = useEditor.getState();
      if (event.ctrlKey || event.metaKey) {
        const factor = Math.exp(-event.deltaY * 0.0022);
        state.setCamera(zoomAtPoint(state.camera, state.camera.zoom * factor, pointer));
      } else if (event.shiftKey && !event.deltaX) {
        state.panBy(-event.deltaY, 0);
      } else {
        state.panBy(-event.deltaX, -event.deltaY);
      }
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, []);

  const startPan = (event: React.PointerEvent) => {
    interaction.current = { kind: 'pan', start: { x: event.clientX, y: event.clientY }, camera };
    svgRef.current?.setPointerCapture(event.pointerId);
  };

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button === 2) return;
    const state = useEditor.getState();
    if (state.editingId) state.setEditing(null);

    const isPanGesture = tool === 'hand' || spaceDown || event.button === 1;
    if (isPanGesture) {
      startPan(event);
      return;
    }

    const world = getWorld(event);
    const target = event.target as Element;
    const handleId = target.getAttribute?.('data-handle') as HandleId | null;
    const rotateHandle = target.getAttribute?.('data-rotate');

    if (handleId && singleSelection && interactive) {
      state.beginGesture();
      interaction.current = { kind: 'resize', handle: handleId, id: singleSelection.id, origin: { ...singleSelection } };
      svgRef.current?.setPointerCapture(event.pointerId);
      return;
    }

    if (rotateHandle && singleSelection && interactive) {
      state.beginGesture();
      const center = {
        x: singleSelection.x + singleSelection.width / 2,
        y: singleSelection.y + singleSelection.height / 2,
      };
      interaction.current = {
        kind: 'rotate',
        id: singleSelection.id,
        startAngle: Math.atan2(world.y - center.y, world.x - center.x),
        originAngle: singleSelection.angle,
      };
      svgRef.current?.setPointerCapture(event.pointerId);
      return;
    }

    if (!interactive) {
      const hit = elementAtPoint(elements, world, { includeLocked: true });
      state.setSelection(hit ? [hit.id] : []);
      return;
    }

    if (tool === 'eraser') {
      state.beginGesture();
      interaction.current = { kind: 'erase' };
      state.eraseAt(world, 10 / camera.zoom);
      svgRef.current?.setPointerCapture(event.pointerId);
      return;
    }

    if (tool === 'pen' || tool === 'highlighter') {
      const element = createElement(
        tool === 'pen' ? 'draw' : 'highlighter',
        world.x,
        world.y,
        1,
        1,
        {
          points: [{ x: 0, y: 0 }],
          stroke: style.stroke,
          strokeWidth: tool === 'highlighter' ? Math.max(style.strokeWidth * 6, 12) : style.strokeWidth,
          fillStyle: 'none',
          fill: 'transparent',
          strokeStyle: 'solid',
        },
        style,
      );
      state.beginGesture();
      state.addElement(element, { select: false });
      interaction.current = { kind: 'draw', id: element.id, points: [{ x: world.x, y: world.y }] };
      svgRef.current?.setPointerCapture(event.pointerId);
      return;
    }

    if (tool === 'text') {
      const element = createElement('text', world.x, world.y, 260, Math.max(44, style.fontSize * 1.7), {
        text: '',
        fillStyle: 'none',
        fill: 'transparent',
        stroke: style.stroke,
        strokeWidth: 0,
        textStyle: {
          text: '',
          fontSize: style.fontSize,
          fontFamily: style.fontFamily,
          textAlign: 'left',
          bold: false,
          italic: false,
        },
      }, style);
      state.beginGesture();
      state.addElement(element);
      state.endGesture();
      state.setEditing(element.id);
      return;
    }

    if (tool === 'sticky') {
      const element = createElement(
        'sticky',
        Math.round((world.x - 90) / 8) * 8,
        Math.round((world.y - 90) / 8) * 8,
        190,
        190,
        { text: '', stroke: 'transparent', strokeWidth: 1, fillStyle: 'solid', fill: style.stickyColor },
        style,
      );
      state.addElement(element);
      state.setEditing(element.id);
      return;
    }

    if (['rect', 'ellipse', 'diamond', 'line', 'arrow'].includes(tool)) {
      const element = createElement(tool as BoardElement['type'], world.x, world.y, 1, 1, {
        points: tool === 'line' || tool === 'arrow' ? [{ x: 0, y: 0 }, { x: 1, y: 1 }] : undefined,
        stroke: style.stroke,
        fill: style.fill,
        fillStyle: style.fillStyle,
        strokeWidth: style.strokeWidth,
        strokeStyle: style.strokeStyle,
        arrowEnd: tool === 'arrow' ? 'arrow' : 'none',
      }, style);
      state.beginGesture();
      state.addElement(element, { select: false });
      interaction.current = {
        kind: 'create',
        id: element.id,
        start: world,
        type: tool as 'rect' | 'ellipse' | 'diamond' | 'line' | 'arrow',
      };
      svgRef.current?.setPointerCapture(event.pointerId);
      return;
    }

    if (tool === 'connector') {
      const target = connectorTargetAt(elements, world, 36 / camera.zoom);
      interaction.current = {
        kind: 'connector',
        start: target ? target.binding : world,
        point: world,
        hoverId: target?.element.id ?? null,
        hoverBinding: target?.binding ?? null,
      };
      setConnectorPreview({ start: target ? world : world, end: world });
      svgRef.current?.setPointerCapture(event.pointerId);
      return;
    }

    // Default: select tool behaviours.
    const hit = elementAtPoint(elements, world);
    if (hit) {
      const alreadySelected = selectedIds.includes(hit.id);
      if (event.shiftKey) {
        state.toggleSelection(hit.id, true);
      } else if (!alreadySelected) {
        state.setSelection([hit.id]);
      }

      const nextIds = useEditor.getState().selectedIds;
      const movable = useEditor
        .getState()
        .elements.filter((element) => nextIds.includes(element.id) && !element.locked);
      if (movable.length) {
        state.beginGesture();
        interaction.current = {
          kind: 'move',
          start: world,
          ids: movable.map((element) => element.id),
          origins: Object.fromEntries(movable.map((element) => [element.id, { x: element.x, y: element.y }])),
        };
        svgRef.current?.setPointerCapture(event.pointerId);
      }
      return;
    }

    if (!event.shiftKey) state.clearSelection();
    interaction.current = { kind: 'marquee', start: world, current: world, additive: event.shiftKey };
    svgRef.current?.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const state = useEditor.getState();
    const world = getWorld(event);
    const active = interaction.current;

    if (tool === 'connector' && active.kind === 'none') {
      const target = connectorTargetAt(elements, world, 36 / camera.zoom);
      setHoverTarget(target ? { id: target.element.id, binding: target.binding } : null);
    } else if (hoverTarget) {
      setHoverTarget(null);
    }

    switch (active.kind) {
      case 'none':
        return;
      case 'pan': {
        state.setCamera({
          ...active.camera,
          x: active.camera.x + (event.clientX - active.start.x),
          y: active.camera.y + (event.clientY - active.start.y),
        });
        return;
      }
      case 'marquee': {
        const rect = normalizeRect(active.start, world);
        active.current = world;
        setMarquee(rect);
        return;
      }
      case 'move': {
        const dx = world.x - active.start.x;
        const dy = world.y - active.start.y;
        const movingElements = state.elements.filter((element) => active.ids.includes(element.id));
        const movingBounds = selectionBounds(movingElements);
        const proposed = { ...movingBounds, x: movingBounds.x + dx, y: movingBounds.y + dy };
        const snap = event.altKey ? { dx: 0, dy: 0, guides: [] } : snapSelection(state.elements, active.ids, proposed);
        const snappedDx = dx + snap.dx;
        const snappedDy = dy + snap.dy;
        setGuides(snap.guides);
        state.updateElements(
          Object.fromEntries(
            active.ids.map((id) => {
              const origin = active.origins[id];
              return [id, { x: origin.x + snappedDx, y: origin.y + snappedDy }];
            }),
          ),
        );
        return;
      }
      case 'resize': {
        const origin = active.origin;
        const local = toLocal(world, origin);
        const next = resizeElement(origin, active.handle, local, {
          keepAspect: event.shiftKey,
          minSize: 6,
        });
        const center = { x: origin.x + origin.width / 2, y: origin.y + origin.height / 2 };
        const newCenter = { x: next.x + next.width / 2, y: next.y + next.height / 2 };
        const shift = rotatePoint(newCenter, center, origin.angle);
        const patch: Partial<BoardElement> = {
          width: next.width,
          height: next.height,
          x: shift.x - next.width / 2,
          y: shift.y - next.height / 2,
        };
        if (origin.points) {
          const scaleX = origin.width ? next.width / origin.width : 1;
          const scaleY = origin.height ? next.height / origin.height : 1;
          patch.points = origin.points.map((point) => ({ x: point.x * scaleX, y: point.y * scaleY }));
        }
        // Scale label text with the shape so it never overflows after a resize.
        if (origin.textStyle && !['text', 'sticky'].includes(origin.type) && origin.height > 0) {
          const ratio = next.height / origin.height;
          patch.textStyle = {
            ...origin.textStyle,
            fontSize: Math.min(96, Math.max(10, Math.round(origin.textStyle.fontSize * Math.max(0.6, ratio)))),
          };
        }
        state.updateElement(active.id, patch);
        return;
      }
      case 'rotate': {
        const origin = state.elements.find((element) => element.id === active.id);
        if (!origin) return;
        const center = { x: origin.x + origin.width / 2, y: origin.y + origin.height / 2 };
        const angle = Math.atan2(world.y - center.y, world.x - center.x);
        let nextAngle = active.originAngle + (angle - active.startAngle);
        if (event.shiftKey) nextAngle = Math.round(nextAngle / (Math.PI / 12)) * (Math.PI / 12);
        state.updateElement(active.id, { angle: nextAngle });
        return;
      }
      case 'draw': {
        const element = state.elements.find((item) => item.id === active.id);
        if (!element) return;
        const last = active.points[active.points.length - 1];
        if (distance(last, world) * camera.zoom < 2) return;
        active.points.push(world);
        const localPoints = active.points.map((point) => ({ x: point.x - element.x, y: point.y - element.y }));
        const xs = localPoints.map((point) => point.x);
        const ys = localPoints.map((point) => point.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const width = Math.max(Math.max(...xs) - minX, 1);
        const height = Math.max(Math.max(...ys) - minY, 1);
        state.updateElement(active.id, {
          x: element.x + minX,
          y: element.y + minY,
          width,
          height,
          points: localPoints.map((point) => ({ x: point.x - minX, y: point.y - minY })),
        });
        return;
      }
      case 'create': {
        const element = state.elements.find((item) => item.id === active.id);
        if (!element) return;
        if (element.type === 'line' || element.type === 'arrow') {
          const start = active.start;
          const rect = normalizeRect(start, world);
          const local = { x: world.x - rect.x, y: world.y - rect.y };
          const startLocal = { x: start.x - rect.x, y: start.y - rect.y };
          state.updateElement(active.id, {
            x: rect.x,
            y: rect.y,
            width: Math.max(rect.width, 1),
            height: Math.max(rect.height, 1),
            points: [startLocal, local],
          });
        } else {
          const rect = normalizeRect(active.start, world);
          state.updateElement(active.id, {
            x: rect.x,
            y: rect.y,
            width: Math.max(rect.width, 1),
            height: Math.max(rect.height, 1),
          });
        }
        return;
      }
      case 'erase': {
        state.eraseAt(world, 12 / camera.zoom);
        return;
      }
      case 'connector': {
        const target = connectorTargetAt(state.elements, world, 36 / camera.zoom);
        active.point = world;
        active.hoverId = target?.element.id ?? null;
        active.hoverBinding = target?.binding ?? null;
        setHoverTarget(target ? { id: target.element.id, binding: target.binding } : null);
        const fallbackStart: Point = 'x' in active.start ? active.start : world;
        const start = resolveEndpoint(active.start, fallbackStart, state.elements);
        setConnectorPreview({ start, end: target ? resolveEndpoint(target.binding, world, state.elements) : world });
        return;
      }
      default:
        return;
    }
  };

  const onPointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    const state = useEditor.getState();
    const active = interaction.current;
    const world = getWorld(event);
    interaction.current = { kind: 'none' };
    setGuides([]);

    if (active.kind === 'marquee') {
      setMarquee(null);
      const rect = normalizeRect(active.start, world);
      if (rect.width < 3 && rect.height < 3) {
        if (!active.additive) state.clearSelection();
        return;
      }
      const hits = elementsInRect(state.elements, rect).map((element) => element.id);
      state.setSelection(active.additive ? Array.from(new Set([...state.selectedIds, ...hits])) : hits);
      return;
    }

    if (active.kind === 'draw') {
      state.endGesture();
      const element = useEditor.getState().elements.find((item) => item.id === active.id);
      if (!element || (element.points?.length ?? 0) < 2) {
        state.removeElements([active.id]);
      }
      return;
    }

    if (active.kind === 'create') {
      const element = useEditor.getState().elements.find((item) => item.id === active.id);
      state.endGesture();
      if (!element) return;
      if (element.width < 3 && element.height < 3) {
        state.removeElements([active.id]);
        return;
      }
      state.setSelection([active.id]);
      if (element.type !== 'line' && element.type !== 'arrow') state.setTool('select');
      return;
    }

    if (active.kind === 'connector') {
      const target = connectorTargetAt(state.elements, world, 40 / camera.zoom);
      setConnectorPreview(null);
      setHoverTarget(null);
      if (target) {
        const startBinding: ElementBinding | Point = active.start;
        const connector = createElement('connector', 0, 0, 0, 0, {
          start: startBinding,
          end: target.binding,
          arrowEnd: 'arrow',
          arrowStart: 'none',
          stroke: state.style.stroke,
          strokeWidth: Math.max(state.style.strokeWidth, 1.5),
          fillStyle: 'none',
          fill: 'transparent',
        });
        state.addElement(connector, { select: false });
      }
      return;
    }

    if (active.kind === 'move' || active.kind === 'resize' || active.kind === 'rotate' || active.kind === 'erase') {
      state.endGesture();
    }
  };

  const onDoubleClick = (event: React.MouseEvent<SVGSVGElement>) => {
    if (readOnly) return;
    const world = getWorld(event);
    const state = useEditor.getState();
    const hit = elementAtPoint(state.elements, world, { includeLocked: true });
    if (!hit) {
      if (tool === 'select') {
        const element = createElement('text', world.x, world.y, 260, Math.max(44, style.fontSize * 1.7), {
          text: '',
          fillStyle: 'none',
          fill: 'transparent',
          stroke: style.stroke,
          strokeWidth: 0,
          textStyle: { text: '', fontSize: style.fontSize, fontFamily: style.fontFamily, textAlign: 'left', bold: false, italic: false },
        }, style);
        state.addElement(element);
        state.setEditing(element.id);
      }
      return;
    }
    if (hit.locked) return;
    if (['sticky', 'text', 'rect', 'ellipse', 'diamond'].includes(hit.type)) {
      state.setSelection([hit.id]);
      state.setEditing(hit.id);
    }
  };

  // Live element being edited through the inline text editor.
  const editingElement = useMemo(() => elements.find((element) => element.id === editingId) ?? null, [elements, editingId]);

  return (
    <div
      ref={containerRef}
      id="board-canvas"
      className="relative h-full w-full overflow-hidden"
      style={{ cursor: cursorFor(tool, spaceDown) }}
    >
      <CanvasBackground background={background} camera={camera} />
      <svg
        ref={svgRef}
        className="absolute inset-0 h-full w-full touch-none select-none"
        role="application"
        aria-label="Whiteboard canvas"
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
        onContextMenu={(event) => event.preventDefault()}
      >
        <g transform={`translate(${camera.x} ${camera.y}) scale(${camera.zoom})`}>
          {elements.map((element) => (
            <g
              key={element.id}
              data-element-id={element.id}
              style={{ cursor: readOnly ? 'default' : 'inherit' }}
            >
              <RenderElement element={element} elements={elements} />
            </g>
          ))}

          {/* Snap guides */}
          {guides.map((guide, index) =>
            guide.orientation === 'vertical' ? (
              <line
                key={`guide-${index}`}
                x1={guide.position}
                x2={guide.position}
                y1={guide.start - 40}
                y2={guide.end + 40}
                stroke="#ec4899"
                strokeWidth={1 / camera.zoom}
                strokeDasharray={`${4 / camera.zoom} ${4 / camera.zoom}`}
                pointerEvents="none"
              />
            ) : (
              <line
                key={`guide-${index}`}
                y1={guide.position}
                y2={guide.position}
                x1={guide.start - 40}
                x2={guide.end + 40}
                stroke="#ec4899"
                strokeWidth={1 / camera.zoom}
                strokeDasharray={`${4 / camera.zoom} ${4 / camera.zoom}`}
                pointerEvents="none"
              />
            ),
          )}

          {/* Marquee */}
          {marquee ? (
            <rect
              x={marquee.x}
              y={marquee.y}
              width={marquee.width}
              height={marquee.height}
              fill="rgba(79,70,229,.08)"
              stroke="#4f46e5"
              strokeWidth={1 / camera.zoom}
              strokeDasharray={`${5 / camera.zoom} ${4 / camera.zoom}`}
              pointerEvents="none"
            />
          ) : null}

          {/* Connector preview */}
          {connectorPreview ? (
            <path
              d={connectorPath(connectorPreview.start, connectorPreview.end)}
              fill="none"
              stroke={style.stroke}
              strokeWidth={Math.max(style.strokeWidth, 1.5)}
              strokeDasharray={`${6 / camera.zoom} ${4 / camera.zoom}`}
              pointerEvents="none"
            />
          ) : null}

          {/* Connector attach indicators */}
          {hoverTarget
            ? (() => {
                const target = elements.find((element) => element.id === hoverTarget.id);
                if (!target) return null;
                const local = {
                  x: target.x - 6 / camera.zoom,
                  y: target.y - 6 / camera.zoom,
                  width: target.width + 12 / camera.zoom,
                  height: target.height + 12 / camera.zoom,
                };
                const center = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
                const anchor = resolveEndpoint(hoverTarget.binding, center, elements);
                return (
                  <>
                    <rect
                      {...local}
                      rx={8}
                      fill="none"
                      stroke="#6366f1"
                      strokeWidth={1.5 / camera.zoom}
                      pointerEvents="none"
                    />
                    <circle cx={anchor.x} cy={anchor.y} r={5 / camera.zoom} fill="#6366f1" pointerEvents="none" />
                  </>
                );
              })()
            : null}

          {/* Selection outlines, handles, rotate */}
          {interactive
            ? selectedElements.map((element) => {
                if (element.locked) {
                  return (
                    <rect
                      key={`lock-${element.id}`}
                      x={element.x - 4 / camera.zoom}
                      y={element.y - 4 / camera.zoom}
                      width={element.width + 8 / camera.zoom}
                      height={element.height + 8 / camera.zoom}
                      fill="none"
                      stroke="#94a3b8"
                      strokeDasharray={`${4 / camera.zoom} ${3 / camera.zoom}`}
                      transform={
                        element.angle
                          ? `rotate(${(element.angle * 180) / Math.PI} ${element.x + element.width / 2} ${element.y + element.height / 2})`
                          : undefined
                      }
                      pointerEvents="none"
                    />
                  );
                }
                return (
                  <rect
                    key={`sel-${element.id}`}
                    x={element.x}
                    y={element.y}
                    width={element.width}
                    height={element.height}
                    fill="none"
                    stroke="#6366f1"
                    strokeWidth={1 / camera.zoom}
                    transform={
                      element.angle
                        ? `rotate(${(element.angle * 180) / Math.PI} ${element.x + element.width / 2} ${element.y + element.height / 2})`
                        : undefined
                    }
                    pointerEvents="none"
                  />
                );
              })
            : null}

          {interactive && singleSelection && !singleSelection.locked && !editingId
            ? (() => {
                const element = singleSelection;
                const center = { x: element.x + element.width / 2, y: element.y + element.height / 2 };
                const handleSize = 9 / camera.zoom;
                const rect = elementRect(element);
                const rotatePointPos = rotatePoint(
                  { x: center.x, y: element.y - 26 / camera.zoom },
                  center,
                  element.angle,
                );
                return (
                  <g>
                    <line
                      x1={center.x}
                      y1={element.y}
                      x2={rotatePointPos.x}
                      y2={rotatePointPos.y}
                      stroke="#6366f1"
                      strokeWidth={1 / camera.zoom}
                      transform={`rotate(${(element.angle * 180) / Math.PI} ${center.x} ${center.y})`}
                      pointerEvents="none"
                    />
                    <circle
                      data-rotate="true"
                      cx={rotatePointPos.x}
                      cy={rotatePointPos.y}
                      r={6 / camera.zoom}
                      fill="#ffffff"
                      stroke="#6366f1"
                      strokeWidth={1.5 / camera.zoom}
                      style={{ cursor: 'grab' }}
                    />
                    {HANDLE_IDS.map((handle) => {
                      const point = rotatePoint(handlePoint(rect, handle), center, element.angle);
                      return (
                        <rect
                          key={handle}
                          data-handle={handle}
                          x={point.x - handleSize / 2}
                          y={point.y - handleSize / 2}
                          width={handleSize}
                          height={handleSize}
                          rx={1.5 / camera.zoom}
                          fill="#ffffff"
                          stroke="#6366f1"
                          strokeWidth={1.5 / camera.zoom}
                          style={{ cursor: `${handle}-resize` }}
                        />
                      );
                    })}
                  </g>
                );
              })()
            : null}

          {interactive && isLockedSelection ? (
            <g pointerEvents="none">
              <rect
                x={bounds.x - 8 / camera.zoom}
                y={bounds.y - 8 / camera.zoom}
                width={bounds.width + 16 / camera.zoom}
                height={bounds.height + 16 / camera.zoom}
                rx={4 / camera.zoom}
                fill="none"
                stroke="#94a3b8"
                strokeWidth={1.2 / camera.zoom}
                strokeDasharray={`${5 / camera.zoom} ${4 / camera.zoom}`}
              />
            </g>
          ) : null}
        </g>
      </svg>

      {editingElement ? (
        <TextEditor
          key={editingElement.id}
          element={editingElement}
          camera={camera}
          onCommit={(text) => {
            const state = useEditor.getState();
            const trimmed = text.trim();
            if (!trimmed && ['sticky', 'text'].includes(editingElement.type)) {
              state.removeElements([editingElement.id]);
            } else {
              state.updateElement(editingElement.id, {
                textStyle: {
                  ...(editingElement.textStyle ?? {
                    fontSize: 20,
                    fontFamily: 'sans' as const,
                    textAlign: 'center' as const,
                    bold: false,
                    italic: false,
                  }),
                  text,
                },
              });
            }
            state.setEditing(null);
          }}
          onCancel={() => useEditor.getState().setEditing(null)}
        />
      ) : null}
    </div>
  );
}

const cursorFor = (tool: string, spaceDown: boolean) => {
  if (spaceDown || tool === 'hand') return 'grab';
  switch (tool) {
    case 'pen':
    case 'highlighter':
    case 'sticky':
    case 'rect':
    case 'ellipse':
    case 'diamond':
    case 'line':
    case 'arrow':
    case 'connector':
      return 'crosshair';
    case 'eraser':
      return 'cell';
    case 'text':
      return 'text';
    default:
      return 'default';
  }
};
