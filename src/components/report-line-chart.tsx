import { formatPeso } from "@/lib/money";

type Point = { date: string; grossCents: number; collectedCents: number; bookingCount: number };

export function ReportLineChart({ points, metric, query }: { points: Point[]; metric: "gross" | "collected"; query: Record<string, string | undefined> }) {
  const width = 900;
  const height = 280;
  const padding = { left: 58, right: 24, top: 24, bottom: 42 };
  const values = points.map((point) => metric === "gross" ? point.grossCents : point.collectedCents);
  const maximum = Math.max(1, ...values);
  const usableWidth = width - padding.left - padding.right;
  const usableHeight = height - padding.top - padding.bottom;
  const coordinates = points.map((point, index) => ({
    ...point,
    value: values[index],
    x: padding.left + (points.length === 1 ? usableWidth / 2 : (index / Math.max(1, points.length - 1)) * usableWidth),
    y: padding.top + usableHeight - (values[index] / maximum) * usableHeight,
  }));
  const path = coordinates.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const labelEvery = Math.max(1, Math.ceil(points.length / 6));

  function hrefFor(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...query, ...overrides })) if (value) params.set(key, value);
    return `?${params}`;
  }

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6" aria-labelledby="daily-sales-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h2 id="daily-sales-title" className="text-lg font-black">Daily sales</h2><p className="mt-1 text-xs text-[var(--text-muted)]">Select a point to show that day’s transactions.</p></div>
        <div className="flex rounded-full bg-[var(--cream)] p-1" aria-label="Chart metric">
          <a href={hrefFor({ metric: "gross", day: undefined, page: undefined })} className={`rounded-full px-4 py-2 text-xs font-black ${metric === "gross" ? "bg-white text-[var(--forest)] shadow-sm" : "text-[var(--text-muted)]"}`}>Gross booking value</a>
          <a href={hrefFor({ metric: "collected", day: undefined, page: undefined })} className={`rounded-full px-4 py-2 text-xs font-black ${metric === "collected" ? "bg-white text-[var(--forest)] shadow-sm" : "text-[var(--text-muted)]"}`}>Collected</a>
        </div>
      </div>
      <div className="mt-5 overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${metric === "gross" ? "Gross booking value" : "Collected payments"} by scheduled date`} className="min-w-[44rem]">
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padding.top + usableHeight - ratio * usableHeight;
            return <g key={ratio}><line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#dce2d7" strokeDasharray="4 5" /><text x={padding.left - 10} y={y + 4} textAnchor="end" fontSize="10" fill="#627066">{formatPeso(Math.round(maximum * ratio)).replace(".00", "")}</text></g>;
          })}
          {path ? <path d={path} fill="none" stroke="var(--forest)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /> : null}
          {coordinates.map((point, index) => {
            const params = new URLSearchParams();
            for (const [key, value] of Object.entries({ ...query, day: point.date, page: undefined })) if (value) params.set(key, value);
            return <g key={point.date}><a href={`?${params}`} aria-label={`${point.date}: ${formatPeso(point.value)}, ${point.bookingCount} bookings`}><circle cx={point.x} cy={point.y} r="7" fill="var(--lime)" stroke="var(--forest)" strokeWidth="3"><title>{`${point.date} · ${formatPeso(point.value)} · ${point.bookingCount} booking${point.bookingCount === 1 ? "" : "s"}`}</title></circle></a>{index % labelEvery === 0 || index === coordinates.length - 1 ? <text x={point.x} y={height - 14} textAnchor="middle" fontSize="10" fill="#627066">{new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${point.date}T00:00:00Z`))}</text> : null}</g>;
          })}
        </svg>
      </div>
    </section>
  );
}
