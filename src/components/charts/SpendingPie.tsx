import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { Subscription } from "../../types";

const COLORS = ["#38bdf8", "#a78bfa", "#f472b6", "#22d3ee", "#f59e0b", "#34d399", "#c084fc"];

type Props = {
  subscriptions: Subscription[];
};

export function SpendingPie({ subscriptions }: Props) {
  const data = Object.values(
    subscriptions.reduce((acc, sub) => {
      const prev = acc[sub.category] ?? { name: sub.category, value: 0 };
      acc[sub.category] = { ...prev, value: prev.value + (sub.estimatedMonthlySpend || sub.monthlyAmount || 0) };
      return acc;
    }, {} as Record<string, { name: string; value: number }>),
  );

  return (
    <ResponsiveContainer width="100%" height={320}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          outerRadius={110}
          dataKey="value"
          paddingAngle={2}
        >
          {data.map((entry, index) => (
            <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b" }} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
