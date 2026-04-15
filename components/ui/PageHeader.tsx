import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  stats?: { label: string; value: string | number; color?: string }[];
}

export default function PageHeader({ title, subtitle, action, stats }: PageHeaderProps) {
  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>
      {stats && stats.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {stats.map((s, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-xl px-4 py-2 shadow-sm">
              <p className="text-xs text-gray-500 font-medium">{s.label}</p>
              <p className={`text-lg font-bold ${s.color ?? "text-gray-800"}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
