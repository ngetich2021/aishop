import { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  sub?: string;
  icon?: ReactNode;
  color?: "blue" | "green" | "purple" | "orange" | "red" | "indigo";
  trend?: { value: number; label: string };
}

const colorMap = {
  blue:   { bg: "bg-blue-50",   icon: "bg-blue-100 text-blue-600",   val: "text-blue-700"   },
  green:  { bg: "bg-green-50",  icon: "bg-green-100 text-green-600", val: "text-green-700"  },
  purple: { bg: "bg-purple-50", icon: "bg-purple-100 text-purple-600", val: "text-purple-700" },
  orange: { bg: "bg-orange-50", icon: "bg-orange-100 text-orange-600", val: "text-orange-700" },
  red:    { bg: "bg-red-50",    icon: "bg-red-100 text-red-600",     val: "text-red-700"    },
  indigo: { bg: "bg-indigo-50", icon: "bg-indigo-100 text-indigo-600", val: "text-indigo-700" },
};

export default function StatCard({ title, value, sub, icon, color = "indigo", trend }: StatCardProps) {
  const c = colorMap[color];
  return (
    <div className={`${c.bg} rounded-2xl p-4 flex flex-col gap-2 shadow-sm border border-white`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</p>
        {icon && (
          <span className={`${c.icon} p-2 rounded-xl text-lg`}>{icon}</span>
        )}
      </div>
      <p className={`text-2xl font-bold ${c.val} leading-tight`}>{value}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
      {trend && (
        <p className={`text-xs font-medium ${trend.value >= 0 ? "text-green-600" : "text-red-500"}`}>
          {trend.value >= 0 ? "▲" : "▼"} {Math.abs(trend.value)}% {trend.label}
        </p>
      )}
    </div>
  );
}
