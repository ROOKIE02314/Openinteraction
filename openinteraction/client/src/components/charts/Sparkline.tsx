import './sparkline.css';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const SVG_WIDTH = 800;
const SVG_HEIGHT = 120;
const CHART_BOTTOM = 100;
const BASELINE = 120;

interface SparklineProps {
  points: Array<{ month: string; count: number }>;
  emptyText?: string;
}

function monthLabel(monthKey: string): string {
  const idx = parseInt(monthKey.slice(5), 10) - 1;
  return MONTH_NAMES[idx] ?? monthKey;
}

function buildPath(points: Array<{ count: number }>, stepX: number): { line: string; area: string } {
  if (points.length === 0) return { line: '', area: '' };
  const maxV = Math.max(1, ...points.map(p => p.count));
  const coords = points.map((p, i) => ({
    x: i * stepX,
    y: CHART_BOTTOM - (p.count / maxV) * CHART_BOTTOM,
  }));

  let line = `M${coords[0].x},${coords[0].y}`;
  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1];
    const curr = coords[i];
    const cx = (prev.x + curr.x) / 2;
    line += ` C${cx},${prev.y} ${cx},${curr.y} ${curr.x},${curr.y}`;
  }
  const area = `${line} L${coords[coords.length - 1].x},${BASELINE} L${coords[0].x},${BASELINE} Z`;
  return { line, area };
}

function Sparkline({ points, emptyText = 'Waiting for first interviews' }: SparklineProps) {
  const allZero = points.every(p => p.count === 0);
  const stepX = points.length > 1 ? SVG_WIDTH / (points.length - 1) : 0;
  const { line, area } = buildPath(points, stepX);

  return (
    <div className="sparkline-root">
      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        className="sparkline-svg"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {!allZero && line && (
          <>
            <path d={area} className="sparkline-area" />
            <path d={line} className="sparkline-line" />
          </>
        )}
        {allZero && (
          <line
            x1="0"
            y1={CHART_BOTTOM / 2 + 20}
            x2={SVG_WIDTH}
            y2={CHART_BOTTOM / 2 + 20}
            className="sparkline-line sparkline-line--empty"
          />
        )}
        {points.map((p, i) => (
          <text key={p.month} x={i * stepX} y={SVG_HEIGHT - 5} className="sparkline-label">
            {monthLabel(p.month)}
          </text>
        ))}
      </svg>
      {allZero && <div className="sparkline-empty-text">{emptyText}</div>}
    </div>
  );
}

export default Sparkline;
