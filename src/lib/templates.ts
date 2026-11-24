import { binding, createElement, createSticky, createText } from './elements';
import { uid } from './geometry';
import { DEFAULT_STYLE, type ToolStyle } from './palette';
import type { BoardElement, ElementType, TemplateDefinition } from './types';

const style: ToolStyle = { ...DEFAULT_STYLE };

const textEl = (x: number, y: number, text: string, size = 32, width = 520) => {
  const element = createText(x, y, text, { ...style, fontSize: size });
  return { ...element, width, height: size * 1.5, textStyle: { ...element.textStyle!, fontSize: size, bold: true } };
};

const stickyEl = (x: number, y: number, text: string, color: string) =>
  createSticky(x, y, text, { ...style, stickyColor: color });

const shapeEl = (
  type: ElementType,
  x: number,
  y: number,
  width: number,
  height: number,
  text: string,
  fill = '#dbeafe',
  stroke = '#1e293b',
) =>
  createElement(
    type,
    x,
    y,
    width,
    height,
    {
      text,
      fill,
      stroke,
      strokeWidth: 2,
      fillStyle: 'solid',
      textStyle: {
        text,
        fontSize: 18,
        fontFamily: 'sans',
        textAlign: 'center',
        bold: false,
        italic: false,
      },
    },
    style,
  );

const connect = (
  from: BoardElement,
  to: BoardElement,
  fromSide: 'top' | 'right' | 'bottom' | 'left' = 'bottom',
  toSide: 'top' | 'right' | 'bottom' | 'left' = 'top',
  stroke = '#475569',
) =>
  createElement('connector', 0, 0, 0, 0, {
    start: binding(from.id, fromSide),
    end: binding(to.id, toSide),
    arrowEnd: 'arrow',
    arrowStart: 'none',
    stroke,
    strokeWidth: 2,
    fillStyle: 'none',
    fill: 'transparent',
  });

const lane = (x: number, y: number, width: number, height: number, title: string) => {
  const board = createElement('rect', x, y, width, height, {
    fill: '#f1f5f9',
    stroke: '#cbd5e1',
    strokeWidth: 1,
    strokeStyle: 'solid',
    fillStyle: 'solid',
    opacity: 1,
  });
  const label = createText(x + 20, y + 16, title, { ...style, fontSize: 20 });
  return {
    board,
    label: { ...label, width: 160, height: 28, stroke: '#334155', textStyle: { ...label.textStyle!, bold: true, fontSize: 20 } },
  };
};

/**
 * Quick-start board: real, connected content so a brand-new board is never
 * a blank void.
 */
export const buildQuickStart = (): BoardElement[] => {
  const title = textEl(-420, -470, 'Your first board ✨', 40, 700);
  title.textStyle = { ...title.textStyle!, text: 'Your first board ✨' };
  const subtitle: BoardElement = {
    ...createText(-420, -400, '', { ...style, fontSize: 18 }),
    width: 760,
    height: 30,
    stroke: '#64748b',
    textStyle: {
      text: 'Pan with the hand tool · draw with P · double-click any sticky to type',
      fontSize: 18,
      fontFamily: 'sans',
      textAlign: 'left',
      bold: false,
      italic: false,
    },
  };

  const idea = stickyEl(-420, -300, 'Drop an idea here\n(double-click to edit)', '#fde68a');
  const question = stickyEl(-160, -300, 'Ask the team a question ❓', '#bae6fd');
  const action = stickyEl(100, -300, 'Decide on next steps ✅', '#bbf7d0');

  const hub = shapeEl('rect', -220, -30, 360, 110, 'Drag me around — connectors follow!', '#e0e7ff');
  const goal = shapeEl('diamond', 220, -20, 220, 140, 'Ship it?', '#dcfce7');
  const done = shapeEl('rect', 220, 200, 220, 90, 'Celebrate 🎉', '#fef9c3');

  const connectorA = connect(idea, hub, 'bottom', 'left', '#94a3b8');
  const connectorB = connect(question, hub, 'bottom', 'top', '#94a3b8');
  const connectorC = connect(action, hub, 'bottom', 'right', '#94a3b8');
  const connectorD = connect(hub, goal, 'right', 'left');
  const connectorE = connect(goal, done, 'bottom', 'top');

  const hint = createText(-420, 360, 'Tip: press ? for every keyboard shortcut', { ...style, fontSize: 16 });
  hint.stroke = '#64748b';

  return [
    title,
    subtitle,
    idea,
    question,
    action,
    connectorA,
    connectorB,
    connectorC,
    hub,
    goal,
    connectorD,
    done,
    connectorE,
    hint,
  ];
};

export const TEMPLATES: TemplateDefinition[] = [
  {
    id: 'blank',
    name: 'Blank board',
    description: 'An empty grid canvas for open-ended thinking.',
    category: 'brainstorm',
    build: () => [],
  },
  {
    id: 'quick-start',
    name: 'Quick-start board',
    description: 'A guided tour of tools, stickies and connectors.',
    category: 'teaching',
    build: buildQuickStart,
  },
  {
    id: 'brainstorm',
    name: 'Brainstorm',
    description: 'Six idea lanes plus a vitals row for clustering.',
    category: 'brainstorm',
    build: () => {
      const elements: BoardElement[] = [];
      const heading = textEl(-620, -420, 'Brainstorm: how might we…', 36, 760);
      elements.push(heading);

      const colors = ['#fde68a', '#fed7aa', '#fecdd3', '#bbf7d0', '#bae6fd', '#ddd6fe'];
      const prompts = ['People', 'Product', 'Process', 'Partners', 'Place', 'Pricing'];
      for (let i = 0; i < 6; i += 1) {
        const x = -620 + i * 220;
        const label = createText(x, -330, prompts[i], { ...style, fontSize: 18 });
        elements.push({ ...label, stroke: '#475569', height: 26, width: 180, textStyle: { ...label.textStyle!, bold: true } });
        for (let j = 0; j < 3; j += 1) {
          elements.push(stickyEl(x, -290 + j * 215, '', colors[i]));
        }
      }
      const note = createText(-620, 380, 'One idea per sticky · group related notes after the brain dump', { ...style, fontSize: 16 });
      note.stroke = '#64748b';
      elements.push(note);
      return elements;
    },
  },
  {
    id: 'flowchart',
    name: 'Flowchart',
    description: 'Start, decision and outcome shapes wired together.',
    category: 'process',
    build: () => {
      const start = shapeEl('rect', -60, -420, 240, 90, 'Start', '#dcfce7');
      const input = shapeEl('rect', -60, -260, 240, 90, 'Collect requirements', '#dbeafe');
      const decision = shapeEl('diamond', -90, -100, 300, 180, 'Approved?', '#fef9c3');
      const yes = shapeEl('rect', -420, 160, 260, 90, 'Build & ship', '#dcfce7');
      const no = shapeEl('rect', 300, 160, 260, 90, 'Revise & resubmit', '#fee2e2');
      const done = shapeEl('ellipse', -420, 340, 260, 100, 'Done', '#e0e7ff');
      return [
        textEl(-60, -540, 'Flowchart', 36, 520),
        start,
        input,
        decision,
        yes,
        no,
        done,
        connect(start, input, 'bottom', 'top'),
        connect(input, decision, 'bottom', 'top'),
        connect(decision, yes, 'right', 'top'),
        connect(decision, no, 'left', 'top'),
        connect(yes, done, 'bottom', 'top'),
        connect(no, input, 'left', 'right'),
      ];
    },
  },
  {
    id: 'kanban',
    name: 'Kanban',
    description: 'Backlog, doing and done columns with swimlanes.',
    category: 'planning',
    build: () => {
      const elements: BoardElement[] = [textEl(-620, -420, 'Sprint board', 36, 620)];
      const columns = ['Backlog', 'In progress', 'Review', 'Done'];
      const cards = [
        ['Research interviews', 'Draft user flows'],
        ['Wireframe canvas', 'Prototype minimap'],
        ['Design QA', 'Copy review'],
        ['Ship v1', ''],
      ];
      const accent = ['#fde68a', '#bae6fd', '#fecdd3', '#bbf7d0'];
      columns.forEach((column, index) => {
        const { board, label } = lane(-620 + index * 300, -330, 270, 760, column);
        elements.push(board, label);
        cards[index].filter(Boolean).forEach((card, cardIndex) => {
          const sticky = stickyEl(-600 + index * 300, -270 + cardIndex * 120, card, accent[index]);
          elements.push({ ...sticky, width: 230, height: 100 });
        });
      });
      return elements;
    },
  },
  {
    id: 'mindmap',
    name: 'Mind map',
    description: 'A central topic with branches radiating outwards.',
    category: 'brainstorm',
    build: () => {
      const center = shapeEl('ellipse', -170, -110, 340, 220, 'Central idea', '#e0e7ff');
      const branches: [number, number, string, string, 'top' | 'right' | 'bottom' | 'left'][] = [
        [-520, -320, 'Customers', '#fde68a', 'bottom'],
        [220, -320, 'Market', '#bae6fd', 'bottom'],
        [-560, 220, 'Team', '#bbf7d0', 'top'],
        [240, 220, 'Technology', '#fecdd3', 'top'],
      ];
      const elements: BoardElement[] = [center, textEl(-170, -400, 'Mind map', 36, 420)];
      for (const [x, y, label, color, side] of branches) {
        const node = shapeEl('rect', x, y, 260, 100, label, color);
        elements.push(node, connect(center, node, side === 'bottom' ? 'bottom' : 'top', side, '#64748b'));
        const child = stickyEl(x + 30, y + (side === 'bottom' ? 150 : -190), `Detail for ${label.toLowerCase()}`, '#f8fafc');
        elements.push({ ...child, width: 200, height: 140 });
      }
      return elements;
    },
  },
  {
    id: 'meeting',
    name: 'Meeting notes',
    description: 'Agenda, decisions, action items and parking lot.',
    category: 'meeting',
    build: () => {
      const elements: BoardElement[] = [textEl(-560, -420, 'Weekly sync', 36, 720)];
      const agenda = lane(-560, -330, 500, 620, 'Agenda');
      const decisions = lane(-20, -330, 500, 620, 'Decisions');
      const actions = lane(-560, 330, 500, 420, 'Action items');
      const parking = lane(-20, 330, 500, 420, 'Parking lot');
      elements.push(agenda.board, agenda.label, decisions.board, decisions.label, actions.board, actions.label, parking.board, parking.label);

      const agendaLines = ['1. Metrics review', '2. Roadmap risks', '3. Launch checklist', '4. Open questions'];
      agendaLines.forEach((line, index) => {
        const item = createText(-530, -270 + index * 44, line, { ...style, fontSize: 18 });
        elements.push(item);
      });
      const actionLines = ['Owner — task — due date', '• Ana — draft release notes — Fri', '• Sam — QA pass — Wed'];
      actionLines.forEach((line, index) => {
        const item = createText(-530, 400 + index * 44, line, { ...style, fontSize: 18 });
        elements.push(item);
      });
      elements.push(stickyEl(10, -270, 'Decision: ship the beta on the 12th', '#bbf7d0'));
      elements.push(stickyEl(-280, 430, 'Follow up on pricing research', '#fde68a'));
      return elements;
    },
  },
];

export const getTemplate = (id: string) => TEMPLATES.find((template) => template.id === id) ?? TEMPLATES[0];

export const TEMPLATE_PREVIEWS: Record<string, string> = TEMPLATES.reduce<Record<string, string>>((acc, template) => {
  acc[template.id] = template.description;
  return acc;
}, {});

export const templateIdFromGroup = () => uid('template');
