import { describe, expect, it, vi } from 'vitest';
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES, createImageElement, validateImageFile } from '@/lib/upload';

const png = () =>
  new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], 'shot.png', {
    type: 'image/png',
  });

describe('image upload validation', () => {
  it('accepts the documented formats', () => {
    for (const type of ACCEPTED_IMAGE_TYPES) {
      const file = new File([new Uint8Array([1])], `f.${type.split('/')[1]}`, { type });
      expect(validateImageFile(file)).toBeNull();
    }
  });

  it('rejects SVG with a specific explanation', () => {
    const file = new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' });
    expect(validateImageFile(file)).toMatch(/SVG uploads are disabled/i);
  });

  it('rejects oversized and empty files', () => {
    const big = new File([new Uint8Array(MAX_IMAGE_BYTES + 1)], 'big.png', { type: 'image/png' });
    expect(validateImageFile(big)).toMatch(/too large/i);
    const empty = new File([], 'empty.png', { type: 'image/png' });
    expect(validateImageFile(empty)).toMatch(/empty/i);
  });

  it('accepts a PNG whose MIME type is missing (drag from some OSes)', async () => {
    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], 'unnamed', {
      type: '',
    });
    const realImage = globalThis.Image;
    class FakeImage {
      naturalWidth = 640;
      naturalHeight = 480;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        setTimeout(() => this.onload?.(), 0);
      }
    }
    // @ts-expect-error test double
    globalThis.Image = FakeImage;
    try {
      // Never allowed to fail on the missing MIME type.
      await expect(createImageElement(file, { x: 0, y: 0 })).resolves.toMatchObject({
        element: expect.objectContaining({ type: 'image' }),
      });
    } finally {
      globalThis.Image = realImage;
    }
  });

  it('sizes images to fit the canvas without upscaling', async () => {
    const dataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    class FakeImage {
      naturalWidth = 1600;
      naturalHeight = 900;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        setTimeout(() => this.onload?.(), 0);
      }
    }
    // @ts-expect-error test double
    globalThis.Image = FakeImage;
    // @ts-expect-error test double
    globalThis.FileReader = function FakeReader(this: Record<string, unknown>) {
      this.result = dataUrl;
      this.onload = null;
      this.onerror = null;
      this.readAsDataURL = () => setTimeout(() => (this.onload as (() => void) | null)?.(), 0);
    };

    const { element } = await createImageElement(png(), { x: 10, y: 20 });
    expect(element.type).toBe('image');
    expect(element.src).toBe(dataUrl);
    expect(element.width).toBeLessThanOrEqual(520);
    expect(element.height).toBeLessThanOrEqual(620);
    expect(element.imageName).toBe('shot.png');
  });
});
