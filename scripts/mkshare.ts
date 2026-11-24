import { buildQuickStart } from '../src/lib/templates';
import { encodeSharePayload } from '../src/lib/share';

const board = {
  id: 'sharecheck',
  title: 'Share check',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  elements: buildQuickStart(),
  background: { kind: 'grid' as const, color: '#f8fafc' },
  camera: { x: 0, y: 0, zoom: 1 },
};
const encoded = encodeSharePayload(board, 'view');
console.log('https://whiteboard-studio-two.vercel.app/board/sharecheck#s=' + encoded);
