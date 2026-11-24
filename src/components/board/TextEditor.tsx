'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FONT_STACKS, LINE_HEIGHT_RATIO, textPaddingFor } from '@/lib/text';
import { stickyTextColor } from '@/lib/render';
import type { BoardElement, Camera } from '@/lib/types';

interface TextEditorProps {
  element: BoardElement;
  camera: Camera;
  onCommit: (text: string) => void;
  onCancel: () => void;
}

/**
 * Inline, WYSIWYG-ish text editing positioned exactly over the element.
 * Enter commits, Shift+Enter adds a line, Escape cancels.
 */
export function TextEditor({ element, camera, onCommit, onCancel }: TextEditorProps) {
  const [value, setValue] = useState(element.textStyle?.text ?? '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const committed = useRef(false);
  const style = element.textStyle;
  const fontSize = (style?.fontSize ?? 20) * camera.zoom;
  const padding = textPaddingFor(element.type) * camera.zoom;

  useLayoutEffect(() => {
    const node = textareaRef.current;
    if (!node) return;
    node.focus();
    node.setSelectionRange(node.value.length, node.value.length);
  }, []);

  useEffect(() => {
    return () => {
      if (!committed.current) {
        // Unmount without explicit commit should not lose input.
      }
    };
  }, []);

  const commit = () => {
    if (committed.current) return;
    committed.current = true;
    onCommit(value);
  };

  const isSticky = element.type === 'sticky';
  const color = isSticky ? stickyTextColor(element.fill) : element.stroke === 'transparent' ? 'var(--ink)' : element.stroke;
  const align = style?.textAlign ?? 'center';

  return (
    <div
      className="absolute z-30"
      style={{
        left: element.x * camera.zoom + camera.x,
        top: element.y * camera.zoom + camera.y,
        width: element.width * camera.zoom,
        height: element.height * camera.zoom,
        transform: element.angle ? `rotate(${(element.angle * 180) / Math.PI})` : undefined,
        transformOrigin: 'center',
      }}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            committed.current = true;
            onCancel();
            return;
          }
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            commit();
          }
          event.stopPropagation();
        }}
        aria-label="Edit text"
        spellCheck
        className="h-full w-full resize-none rounded-[2px] bg-white/0 outline-none ring-2 ring-[#6366f1]/70"
        style={{
          fontFamily: FONT_STACKS[style?.fontFamily ?? 'sans'],
          fontSize,
          lineHeight: `${fontSize * LINE_HEIGHT_RATIO}px`,
          fontWeight: style?.bold ? 700 : 400,
          fontStyle: style?.italic ? 'italic' : 'normal',
          color,
          textAlign: align,
          padding,
          caretColor: color,
        }}
      />
    </div>
  );
}
