'use client';

import type { Board, SharedBoardPayload } from './types';
import { exportableElements } from './exporters';

/**
 * Share links encode the board snapshot in the URL hash (#s=…).
 * This makes shared boards genuinely viewable by anyone with the link without
 * a server or account, while keeping the payload out of server logs (hashes
 * are never sent to the server).
 *
 * Limits (documented in the README):
 *  - links are a snapshot at share time; they do not live-update
 *  - very large boards (many embedded images) exceed practical URL length
 *    and are rejected with a clear message
 *  - the recipient can view and duplicate the board; edits stay local to them
 */

export const MAX_SHARE_LENGTH = 60_000;

export type SharePermission = 'view' | 'comment' | 'edit';

export const PERMISSION_LABELS: Record<SharePermission, { label: string; description: string }> = {
  view: { label: 'Can view', description: 'Read the board and export a copy.' },
  comment: { label: 'Can review', description: 'View the board and keep local notes.' },
  edit: { label: 'Can edit a copy', description: 'Duplicate the board into their own workspace and edit it.' },
};

const toBase64Url = (value: string) => {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (value: string) => {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

export const encodeSharePayload = (board: Board, permission: SharePermission): string => {
  const payload: SharedBoardPayload = {
    v: 1,
    title: board.title,
    elements: exportableElements(board.elements).map((element) => {
      // Strip local-only fields to keep the URL small.
      const { preview, ...rest } = element;
      return rest;
    }),
    background: board.background,
    permission,
    sharedAt: Date.now(),
  };
  return toBase64Url(JSON.stringify(payload));
};

export const buildShareUrl = (board: Board, permission: SharePermission, origin?: string): string => {
  const base = origin ?? (typeof window !== 'undefined' ? window.location.origin : '');
  const encoded = encodeSharePayload(board, permission);
  if (encoded.length > MAX_SHARE_LENGTH) {
    throw new Error(
      'This board is too large to embed in a link (likely due to uploaded images). Export it as JSON and send the file instead.',
    );
  }
  return `${base}/board/${board.id}#s=${encoded}`;
};

export const parseSharePayload = (hash: string): SharedBoardPayload | null => {
  try {
    const params = new URLSearchParams(hash.replace(/^#/, ''));
    const raw = params.get('s');
    if (!raw) return null;
    const json = JSON.parse(fromBase64Url(raw));
    if (!json || typeof json !== 'object') return null;
    if (!Array.isArray(json.elements)) return null;
    const permission: SharePermission = ['view', 'comment', 'edit'].includes(json.permission)
      ? json.permission
      : 'view';
    return {
      v: Number(json.v) || 1,
      title: typeof json.title === 'string' ? json.title : 'Shared board',
      elements: json.elements,
      background: json.background ?? { kind: 'grid', color: '#f8fafc' },
      permission,
      sharedAt: Number(json.sharedAt) || Date.now(),
    };
  } catch {
    return null;
  }
};

export const sharePermissionHint = (permission: SharePermission) => {
  if (permission === 'view') return 'View-only share link';
  if (permission === 'comment') return 'Review share link';
  return 'Editable copy share link';
};

