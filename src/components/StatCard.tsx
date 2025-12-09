import { ReactNode } from "react";
import { Card, CardContent } from "./ui/card";

type Props = {
  label: string;
  value: string;
  icon?: ReactNode;
  accent?: string;
};

export function StatCard({ label, value, icon, accent }: Props) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="flex items-center justify-between px-5 py-6">
        <div>
          <p className="text-sm uppercase tracking-[0.08em] text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-50">{value}</p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800/70 text-sky-300">
          {icon}
        </div>
      </CardContent>
      {accent ? (
        <div
          className="absolute inset-x-0 bottom-0 h-1 rounded-b-2xl"
          style={{ background: accent }}
          aria-hidden
        />
      ) : null}
    </Card>
  );
}
