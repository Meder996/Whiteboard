'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';

interface PopoverProps {
  trigger: (props: { open: boolean; toggle: () => void; id: string }) => React.ReactNode;
  children: (props: { close: () => void }) => React.ReactNode;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'bottom';
  className?: string;
  label?: string;
}

/**
 * Small accessible popover: closes on outside click and Escape, restores focus
 * to the trigger, and exposes aria-expanded / aria-controls.
 */
export function Popover({ trigger, children, align = 'start', side = 'bottom', className, label }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const id = useId();

  const close = useCallback(() => {
    setOpen(false);
    if (triggerRef.current) triggerRef.current.focus();
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open, close]);

  const alignment =
    align === 'center' ? 'left-1/2 -translate-x-1/2' : align === 'end' ? 'right-0' : 'left-0';

  return (
    <div className="relative" ref={containerRef}>
      <div
        ref={(node) => {
          triggerRef.current = node?.firstElementChild as HTMLElement | null;
        }}
        className="contents"
      >
        {trigger({ open, toggle: () => setOpen((value) => !value), id })}
      </div>
      {open ? (
        <div
          id={id}
          role="dialog"
          aria-label={label}
          className={`absolute z-50 mt-2 animate-pop-in ${side === 'top' ? 'bottom-full mb-2 mt-0' : ''} ${alignment} ${className ?? ''}`}
        >
          {children({ close })}
        </div>
      ) : null}
    </div>
  );
}
