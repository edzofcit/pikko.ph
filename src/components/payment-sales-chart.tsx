import { formatPeso } from "@/lib/money";

type Point = { date: string; totalCents: number };

export function PaymentSalesChart({ points }: { points: Point[] }) {
  const width = 960;
  const height = 300;
  const padding = { left: 62, right: 24, top: 24, bottom: 44 };
  const maximum = Math.max(1, ...points.map((point) => point.totalCents));
  const usableWidth = width - padding.left - padding.right;
  const usableHeight = height - padding.top - padding.bottom;
  const coordinates = points.map((point, index) => ({
    ...point,
    x: padding.left + (points.length === 1 ? usableWidth / 2 : (index / Math.max(1, points.length - 1)) * usableWidth),
    y: padding.top + usableHeight - (point.totalCents / maximum) * usableHeight,
  }));
  const path = coordinates.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const area = path ? `${path} L${coordinates.at(-1)!.x.toFixed(1)},${padding.top + usableHeight} L${coordinates[0].x.toFixed(1)},${padding.top + usableHeight} Z` : "";
  const labelEvery = Math.max(1, Math.ceil(points.length / 7));

  return (
    <section className="rounded-3xl border border-[var(--line)] bg-white p-5 sm:p-6" aria-labelledby="payment-sales-chart-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-[var(--coral)]">Sales movement</p><h2 id="payment-sales-chart-title" className="mt-1 text-xl font-black">Successful payments per day</h2></div>
        <p className="rounded-full bg-[var(--cream)] px-3 py-2 text-xs font-bold text-[var(--text-muted)]">Paid transactions · Asia/Manila</p>
      </div>
      <div className="mt-5 overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Successful payment sales per day" className="min-w-[46rem]">
          <defs><linearGradient id="payment-sales-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--lime)" stopOpacity="0.38" /><stop offset="100%" stopColor="var(--lime)" stopOpacity="0.03" /></linearGradient></defs>
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => { const y = padding.top + usableHeight - ratio * usableHeight; return <g key={ratio}><line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#dce2d7" strokeDasharray="4 5" /><text x={padding.left - 10} y={y + 4} textAnchor="end" fontSize="10" fill="#627066">{formatPeso(Math.round(maximum * ratio)).replace(".00", "")}</text></g>; })}
          {area ? <path d={area} fill="url(#payment-sales-fill)" /> : null}
          {path ? <path d={path} fill="none" stroke="var(--forest)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /> : null}
          {coordinates.map((point, index) => <g key={point.date}><circle cx={point.x} cy={point.y} r="5" fill="var(--lime)" stroke="var(--forest)" strokeWidth="3"><title>{`${point.date} · ${formatPeso(point.totalCents)}`}</title></circle>{index % labelEvery === 0 || index === coordinates.length - 1 ? <text x={point.x} y={height - 15} textAnchor="middle" fontSize="10" fill="#627066">{new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${point.date}T00:00:00Z`))}</text> : null}</g>)}
        </svg>
      </div>
    </section>
  );
}
