import './sparkline.css';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface SparklineProps {
  points: Array<{ month: string; count: number }>;
  emptyText?: string;
}

function monthLabel(monthKey: string): string {
  const idx = parseInt(monthKey.slice(5), 10) - 1;
  return MONTH_NAMES[idx] ?? monthKey;
}

function buildPath(points: Array<{ count: number }>, width: number, lineY: number, baseY: number): { line: string; area: string } {
  if (points.length === 0) return { line: '', area: '' };
  const maxV = Math.max(1, ...points.map(p => p.count));
  const stepX = points.length > 1 ? width / (points.length - 1) : 0;
  const coords = points.map((p, i) => ({
    x: i * stepX,
    y: lineY - (p.count / maxV) * lineY,
  }));

  let line = `M${coords[0].x},${coords[0].y}`;
  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1];
    const curr = coords[i];
    const cx = (prev.x + curr.x) / 2;
    line += ` C${cx},${prev.y} ${cx},${curr.y} ${curr.x},${curr.y}`;
  }
  const area = `${line} L${coords[coords.length - 1].x},${baseY} L${coords[0].x},${baseY} Z`;
  return { line, area };
}

function Sparkline({ points, emptyText = 'Waiting for first interviews' }: SparklineProps) {
  const allZero = points.every(p => p.count === 0);
  const width = 800;
  const height = 120;
  const lineY = 100;
  const baseY = 120;

  const { line, area } = buildPath(points, width, lineY, baseY);

  return (
    <div className="sparkline-root">
      <svg viewBox={`0 0 ${width} ${height}`} className="sparkline-svg" preserveAspectRatio="none">
        {!allZero && line && (
          <>
            <path d={area} className="sparkline-area" />
            <path d={line} className="sparkline-line" />
          </>
        )}
        {allZero && (
          <line x1="0" y1={lineY / 2 + 20} x2={width} y2={lineY / 2 + 20} className="sparkline-line sparkline-line--empty" />
        )}
        {points.map((p, i) => {
          const stepX = points.length > 1 ? width / (points.length - 1) : 0;
          return (
            <text key={p.month} x={i * stepX} y={height - 5} className="sparkline-label">
              {monthLabel(p.month)}
            </text>
          );
        })}
      </svg>
      {allZero && <div className="sparkline-empty-text">{emptyText}</div>}
    </div>
  );
}

export default Sparkline;
