import { useEffect, useRef, useState } from 'react';
import { DoorOpen, List, Minus, MousePointer2, Pencil, Ruler, Save, Square, Trash2, Type } from 'lucide-react';
import { useParams } from 'react-router-dom';
import api from '@/lib/api';

type Kind = 'room' | 'door' | 'stair' | 'line' | 'text' | 'stroke';
type Shape = 'rectangle' | 'round' | 'diamond';
type Direction = 'horizontal' | 'vertical' | 'right' | 'left';
type Selected = { kind: Kind; id: number } | null;
type Item = { id: number; x: number; y: number; width: number; height: number; color: string; rotation: number; name?: string; shape?: Shape; direction?: Direction; value?: string; size?: number; x1?: number; y1?: number; x2?: number; y2?: number; style?: 'solid' | 'dashed' | 'dotted'; points?: string };

const initialRooms: Item[] = [
  { id: 1, name: 'Living room', x: 80, y: 80, width: 300, height: 190, color: '#dbeafe', shape: 'rectangle', rotation: 0 },
  { id: 2, name: 'Kitchen', x: 380, y: 80, width: 180, height: 190, color: '#fef3c7', shape: 'rectangle', rotation: 0 },
  { id: 3, name: 'Bedroom', x: 80, y: 270, width: 220, height: 160, color: '#dcfce7', shape: 'rectangle', rotation: 0 },
  { id: 4, name: 'Bathroom', x: 300, y: 270, width: 140, height: 160, color: '#fce7f3', shape: 'rectangle', rotation: 0 },
];

export default function HousePlanEditor() {
  const [rooms, setRooms] = useState<Item[]>(initialRooms);
  const [doors, setDoors] = useState<Item[]>([]);
  const [stairs, setStairs] = useState<Item[]>([]);
  const [lines, setLines] = useState<Item[]>([]);
  const [texts, setTexts] = useState<Item[]>([]);
  const [strokes, setStrokes] = useState<Item[]>([]);
  const [selected, setSelected] = useState<Selected>(null);
  const [tool, setTool] = useState<'select' | 'pin'>('select');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ kind: Kind; id: number; x: number; y: number } | null>(null);
  const drawingRef = useRef<string[]>([]);
  const importInputRef = useRef<HTMLInputElement>(null);
  const { id } = useParams<{ id: string }>();
  const isSubcontractor = window.location.pathname.startsWith('/sous-traitant/');

  const nextId = () => Math.max(0, ...[...rooms, ...doors, ...stairs, ...lines, ...texts, ...strokes].map((item) => item.id)) + 1;
  const storageKey = `house-plan-2d:${window.location.pathname}`;
  type Design = { version: number; rooms: Item[]; doors: Item[]; stairs: Item[]; lines: Item[]; texts: Item[]; strokes: Item[] };
  const getDesign = (): Design => ({ version: 1, rooms, doors, stairs, lines, texts, strokes });
  const applyDesign = (design: Design) => {
    setRooms(design.rooms);
    setDoors(design.doors);
    setStairs(design.stairs);
    setLines(design.lines);
    setTexts(design.texts);
    setStrokes(design.strokes);
    setSelected(null);
  };
  useEffect(() => {
    if (!id) return;
    api.get<{ plan2d?: Design }>(isSubcontractor ? `/sous-traitant/chantiers/${id}` : `/chantiers/${id}`).then((response) => {
      if (response.data.plan2d) applyDesign(response.data.plan2d);
    }).catch(() => undefined);
  }, [id, isSubcontractor]);
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return;
    try {
      const design = JSON.parse(saved) as Design;
      if (Array.isArray(design.rooms) && Array.isArray(design.doors) && Array.isArray(design.stairs) && Array.isArray(design.lines) && Array.isArray(design.texts) && Array.isArray(design.strokes)) applyDesign(design);
    } catch {
      localStorage.removeItem(storageKey);
    }
  }, [storageKey]);
  const getPoint = (event: React.PointerEvent<SVGSVGElement>) => { const box = svgRef.current?.getBoundingClientRect(); if (!box) return { x: 0, y: 0 }; return { x: (event.clientX - box.left) / box.width * 760, y: (event.clientY - box.top) / box.height * 620 }; };
  const choose = (kind: Kind, id: number) => setSelected({ kind, id });
  const add = (kind: Kind) => { const id = nextId(); if (kind === 'room') setRooms((items) => [...items, { id, name: `Room ${id}`, x: 120, y: 460, width: 140, height: 110, color: '#e0e7ff', shape: 'rectangle', rotation: 0 }]); if (kind === 'door') setDoors((items) => [...items, { id, x: 560, y: 160, width: 70, height: 14, color: '#2563eb', shape: 'round', direction: 'horizontal', rotation: 0 }]); if (kind === 'stair') setStairs((items) => [...items, { id, x: 580, y: 320, width: 100, height: 150, color: '#475569', direction: 'vertical', rotation: 0 }]); if (kind === 'line') setLines((items) => [...items, { id, x: 0, y: 0, width: 0, height: 0, x1: 580, y1: 100, x2: 700, y2: 100, color: '#dc2626', style: 'solid', rotation: 0 }]); choose(kind, id); };
  function addText() { const value = window.prompt('Text to add to the plan:'); if (!value?.trim()) return; const id = nextId(); setTexts((items) => [...items, { id, value: value.trim(), x: 600, y: 540, width: 0, height: 0, size: 18, color: '#7c3aed', rotation: 0 }]); choose('text', id); }
  function deleteSelected() { if (!selected) return; const setters: Record<Kind, React.Dispatch<React.SetStateAction<Item[]>>> = { room: setRooms, door: setDoors, stair: setStairs, line: setLines, text: setTexts, stroke: setStrokes }; setters[selected.kind]((items) => items.filter((item) => item.id !== selected.id)); setSelected(null); }
  async function saveDesign() {
    const design = getDesign();
    setSaveStatus('saving');
    setSaveError('');
    try {
      const imageDataUrl = await exportPlanImage();
      if (!isSubcontractor && id) await api.patch(`/chantiers/${id}/plan-2d`, { plan2d: design, imageDataUrl });
      localStorage.setItem(storageKey, JSON.stringify(design));
      const file = await (await fetch(imageDataUrl)).blob();
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'house-plan-design.png';
      link.click();
      URL.revokeObjectURL(url);
      setSaveStatus('saved');
    } catch (error) {
      setSaveStatus('error');
      const responseMessage = typeof error === 'object' && error !== null && 'response' in error
        ? (error as { response?: { data?: { message?: string | string[] } } }).response?.data?.message
        : undefined;
      setSaveError(Array.isArray(responseMessage) ? responseMessage.join(', ') : responseMessage || 'The server rejected the save. Check the backend logs.');
    }
  }
  function exportPlanImage(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!svgRef.current) { reject(new Error('Plan canvas unavailable')); return; }
      const svg = svgRef.current.cloneNode(true) as SVGSVGElement;
      svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      svg.setAttribute('width', '760');
      svg.setAttribute('height', '620');
      svg.setAttribute('viewBox', '0 0 760 620');
      const image = new Image();
      const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 1520;
        canvas.height = 1240;
        const context = canvas.getContext('2d');
        if (!context) { reject(new Error('Image canvas unavailable')); return; }
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      };
      image.onerror = () => reject(new Error('Plan image export failed'));
      image.src = svgUrl;
    });
  }
  function importDesign(event: React.ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { const design = JSON.parse(String(reader.result)) as Design; if (!Array.isArray(design.rooms) || !Array.isArray(design.doors) || !Array.isArray(design.stairs) || !Array.isArray(design.lines) || !Array.isArray(design.texts) || !Array.isArray(design.strokes)) throw new Error('Invalid design'); applyDesign(design); localStorage.setItem(storageKey, JSON.stringify(design)); } catch { window.alert('This file is not a valid house plan design.'); } }; reader.readAsText(file); event.target.value = ''; }
  function update(property: string, value: string | number) { if (!selected) return; const setters: Record<Kind, React.Dispatch<React.SetStateAction<Item[]>>> = { room: setRooms, door: setDoors, stair: setStairs, line: setLines, text: setTexts, stroke: setStrokes }; setters[selected.kind]((items) => items.map((item) => item.id === selected.id ? { ...item, [property]: value } : item)); }
  function startDrag(event: React.PointerEvent<SVGElement>, kind: Kind, id: number, x: number, y: number) { event.stopPropagation(); const p = getPoint(event as React.PointerEvent<SVGSVGElement>); choose(kind, id); dragRef.current = { kind, id, x: p.x - x, y: p.y - y }; event.currentTarget.setPointerCapture(event.pointerId); }
  function moveDrag(event: React.PointerEvent<SVGSVGElement>) { const drag = dragRef.current; if (!drag) return; const p = getPoint(event); const x = p.x - drag.x; const y = p.y - drag.y; const move = (items: Item[]) => items.map((item) => item.id === drag.id ? { ...item, x, y, ...(drag.kind === 'line' ? { x1: x, y1: y, x2: x + ((item.x2 ?? 0) - (item.x1 ?? 0)), y2: y + ((item.y2 ?? 0) - (item.y1 ?? 0)) } : {}) } : item); if (drag.kind === 'room') setRooms(move); if (drag.kind === 'door') setDoors(move); if (drag.kind === 'stair') setStairs(move); if (drag.kind === 'text') setTexts(move); if (drag.kind === 'line') setLines(move); }
  function beginDraw(event: React.PointerEvent<SVGSVGElement>) { if (tool === 'pin') { const p = getPoint(event); drawingRef.current = [`${p.x},${p.y}`]; } }
  function draw(event: React.PointerEvent<SVGSVGElement>) { if (tool === 'pin' && drawingRef.current.length) { const p = getPoint(event); drawingRef.current.push(`${p.x},${p.y}`); } }
  function finishDraw() { if (tool === 'pin' && drawingRef.current.length > 1) { const id = nextId(); setStrokes((items) => [...items, { id, points: drawingRef.current.join(' '), x: 0, y: 0, width: 4, height: 0, color: '#0f172a', rotation: 0 }]); choose('stroke', id); } drawingRef.current = []; dragRef.current = null; }

  const current = selected ? ({ room: rooms, door: doors, stair: stairs, line: lines, text: texts, stroke: strokes }[selected.kind]).find((item) => item.id === selected.id) : undefined;
  const selectedClass = (kind: Kind, id: number) => selected?.kind === kind && selected.id === id ? '#2563eb' : '#334155';

  return <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4"><div><h2 className="text-lg font-bold text-slate-900">2D House Designer</h2><p className="text-sm text-slate-500">Move and rotate every object freely.</p>{saveStatus === 'saved' && <p className="mt-1 text-xs font-semibold text-emerald-600">Design saved for this chantier.</p>}{saveStatus === 'error' && <p className="mt-1 text-xs font-semibold text-rose-600">{saveError}</p>}</div><div className="flex items-center gap-2"><button type="button" onClick={saveDesign} disabled={saveStatus === 'saving'} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"><Save size={16} /> {saveStatus === 'saving' ? 'Saving...' : 'Save design'}</button><button type="button" onClick={() => importInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Import design</button><input ref={importInputRef} type="file" accept="application/json,.json" onChange={importDesign} className="hidden" /></div></div>
    <div className="grid lg:grid-cols-[230px_1fr]"><aside className="border-b border-slate-200 bg-slate-50 p-4 lg:border-b-0 lg:border-r"><p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Tools</p><div className="space-y-2 text-sm text-slate-600"><button type="button" onClick={() => setTool('select')} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left ${tool === 'select' ? 'bg-white shadow-sm' : ''}`}><MousePointer2 size={16} /> Select / move</button><button type="button" onClick={() => setTool('pin')} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left ${tool === 'pin' ? 'bg-blue-100 text-blue-700' : ''}`}><Pencil size={16} /> Pin / free draw</button><button type="button" onClick={() => add('room')} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-white"><Square size={16} /> Add room</button><button type="button" onClick={() => add('door')} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-white"><DoorOpen size={16} /> Add door</button><button type="button" onClick={() => add('stair')} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-white"><List size={16} /> Add stairs</button><button type="button" onClick={() => add('line')} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-white"><Minus size={16} /> Add line</button><button type="button" onClick={addText} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-white"><Type size={16} /> Add text</button><div className="flex items-center gap-2 rounded-lg px-3 py-2"><Ruler size={16} /> Select an object to edit</div></div>
      {current && <div className="mt-5 border-t border-slate-200 pt-4"><p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Selected {selected?.kind}</p>{current.name !== undefined && <label className="mb-2 block text-xs text-slate-500">Name<input value={current.name} onChange={(event) => update('name', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" /></label>}{current.value !== undefined && <label className="mb-2 block text-xs text-slate-500">Text<input value={current.value} onChange={(event) => update('value', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" /></label>}{current.width !== undefined && <div className="grid grid-cols-2 gap-2"><label className="text-xs text-slate-500">Width<input type="number" min="4" value={current.width} onChange={(event) => update('width', Number(event.target.value))} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" /></label><label className="text-xs text-slate-500">Height<input type="number" min="4" value={current.height} onChange={(event) => update('height', Number(event.target.value))} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" /></label></div>}{current.size !== undefined && <label className="mt-2 block text-xs text-slate-500">Text size<input type="number" min="8" value={current.size} onChange={(event) => update('size', Number(event.target.value))} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" /></label>}<label className="mt-2 block text-xs text-slate-500">Rotation (degrees)<input type="number" value={current.rotation} onChange={(event) => update('rotation', Number(event.target.value))} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" /></label><label className="mt-2 flex items-center justify-between text-xs text-slate-500">Color<input type="color" value={current.color} onChange={(event) => update('color', event.target.value)} className="h-8 w-12 cursor-pointer rounded border border-slate-300" /></label>{(selected?.kind === 'door' || selected?.kind === 'stair') && <label className="mt-2 block text-xs text-slate-500">Direction<select value={current.direction} onChange={(event) => update('direction', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"><option value="horizontal">Horizontal</option><option value="vertical">Vertical</option><option value="right">Right</option><option value="left">Left</option></select></label>}{(selected?.kind === 'room' || selected?.kind === 'door') && <label className="mt-2 block text-xs text-slate-500">Shape<select value={current.shape} onChange={(event) => update('shape', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"><option value="rectangle">Rectangle</option><option value="round">Round</option><option value="diamond">Diamond</option></select></label>}{selected?.kind === 'line' && <><label className="mt-2 block text-xs text-slate-500">Line width<input type="number" min="1" value={current.width} onChange={(event) => update('width', Number(event.target.value))} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" /></label><label className="mt-2 block text-xs text-slate-500">Line style<select value={current.style} onChange={(event) => update('style', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option></select></label></>}<button type="button" onClick={deleteSelected} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-rose-600"><Trash2 size={15} /> Delete element</button></div>}</aside>
      <div className="min-h-[560px] overflow-auto bg-slate-100 p-4"><svg ref={svgRef} viewBox="0 0 760 620" onPointerDown={beginDraw} onPointerMove={(event) => { moveDrag(event); draw(event); }} onPointerUp={finishDraw} onPointerLeave={finishDraw} className="min-h-[540px] min-w-[700px] rounded-xl border border-slate-300 bg-white touch-none" role="img" aria-label="2D house floor plan"><defs><pattern id="plan-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#e2e8f0" /></pattern></defs><rect width="760" height="620" fill="url(#plan-grid)" />
        {rooms.map((item) => <g key={item.id} onPointerDown={(event) => startDrag(event, 'room', item.id, item.x, item.y)} className="cursor-move" transform={`rotate(${item.rotation} ${item.x + item.width / 2} ${item.y + item.height / 2})`}><rect x={item.x} y={item.y} width={item.width} height={item.height} rx={item.shape === 'round' ? 24 : 0} fill={item.color} stroke={selectedClass('room', item.id)} strokeWidth={selected?.kind === 'room' && selected.id === item.id ? 5 : 3} /><text x={item.x + item.width / 2} y={item.y + item.height / 2} textAnchor="middle" dominantBaseline="middle" fill="#1e293b" fontSize="16">{item.name}</text></g>)}
        {doors.map((item) => <g key={item.id} onPointerDown={(event) => startDrag(event, 'door', item.id, item.x, item.y)} className="cursor-move" transform={`rotate(${item.rotation} ${item.x + item.width / 2} ${item.y + item.height / 2})`}><rect x={item.x} y={item.y} width={item.width} height={item.height} rx={item.shape === 'round' ? 8 : 0} fill="white" stroke={item.color} strokeWidth="4" /><path d={`M${item.x} ${item.y} Q${item.x + item.width} ${item.y} ${item.x + item.width} ${item.y + item.width}`} fill="none" stroke={item.color} strokeWidth="2" /></g>)}
        {stairs.map((item) => <g key={item.id} onPointerDown={(event) => startDrag(event, 'stair', item.id, item.x, item.y)} className="cursor-move" transform={`rotate(${item.rotation} ${item.x + item.width / 2} ${item.y + item.height / 2})`}><rect x={item.x} y={item.y} width={item.width} height={item.height} fill="#f8fafc" stroke={item.color} strokeWidth="3" />{Array.from({ length: 8 }, (_, index) => <line key={index} x1={item.x} y1={item.y + 15 + index * 17} x2={item.x + item.width} y2={item.y + 15 + index * 17} stroke={item.color} strokeWidth="2" />)}</g>)}
        {lines.map((item) => <line key={item.id} onPointerDown={(event) => startDrag(event, 'line', item.id, item.x1 ?? 0, item.y1 ?? 0)} x1={item.x1} y1={item.y1} x2={item.x2} y2={item.y2} stroke={item.color} strokeWidth={item.width} strokeDasharray={item.style === 'dashed' ? '12 8' : item.style === 'dotted' ? '2 8' : undefined} transform={`rotate(${item.rotation} ${(item.x1! + item.x2!) / 2} ${(item.y1! + item.y2!) / 2})`} className="cursor-move" />)}
        {texts.map((item) => <text key={item.id} onPointerDown={(event) => startDrag(event, 'text', item.id, item.x, item.y)} x={item.x} y={item.y} fill={item.color} fontSize={item.size} transform={`rotate(${item.rotation} ${item.x} ${item.y})`} className="cursor-move">{item.value}</text>)}{strokes.map((item) => <polyline key={item.id} onPointerDown={(event) => startDrag(event, 'stroke', item.id, item.x, item.y)} points={item.points} fill="none" stroke={item.color} strokeWidth={item.width} transform={`rotate(${item.rotation} 380 310)`} strokeLinecap="round" strokeLinejoin="round" className="cursor-move" />)}
      </svg></div></div>
  </div>;
}
