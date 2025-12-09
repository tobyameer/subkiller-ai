import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const sample = [
  { name: "Jan", spend: 120 },
  { name: "Feb", spend: 140 },
  { name: "Mar", spend: 110 },
  { name: "Apr", spend: 160 },
  { name: "May", spend: 150 },
  { name: "Jun", spend: 180 },
];

export function TrendBar() {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={sample}>
        <XAxis dataKey="name" stroke="#475569" />
        <YAxis stroke="#475569" />
        <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b" }} />
        <Bar dataKey="spend" fill="#38bdf8" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
