import { TEMPLATES } from '../src/lib/templates';
import { renderElementsToSvg } from '../src/lib/svg';
import { selectionBounds } from '../src/lib/geometry';

for (const t of TEMPLATES) {
  const els = t.build();
  const bounds = selectionBounds(els);
  const svg = renderElementsToSvg(els, { kind: 'grid', color: '#f8fafc' });
  console.log(t.id.padEnd(12), 'elements:', String(els.length).padStart(2),
    'bounds:', `${Math.round(bounds.x)},${Math.round(bounds.y)} ${Math.round(bounds.width)}x${Math.round(bounds.height)}`.padEnd(24),
    'svg:', svg.length, 'chars', 'texts:', (svg.match(/<text/g)||[]).length);
  if (svg.includes('NaN') || svg.includes('undefined')) console.log('  !! NaN/undefined in SVG');
}
