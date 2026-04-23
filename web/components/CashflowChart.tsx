"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface Props {
  data: { label: string; income: number }[];
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="glass rounded-xl px-4 py-3"
      style={{ boxShadow: "0 8px 24px rgba(44,51,61,0.10)" }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#acb2bf] mb-1">
        {label}
      </p>
      <p
        className="text-lg font-bold text-[#2c333d]"
        style={{ letterSpacing: "-0.02em" }}
      >
        {new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        }).format(payload[0].value)}
      </p>
    </div>
  );
}

export default function CashflowChart({ data }: Props) {
  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#007aff" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#007aff" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="0"
            horizontal
            vertical={false}
            stroke="#ebeef7"
          />
          <XAxis
            dataKey="label"
            tick={{ fill: "#acb2bf", fontSize: 11, fontFamily: "Inter" }}
            axisLine={false}
            tickLine={false}
            dy={8}
          />
          <YAxis
            tick={{ fill: "#acb2bf", fontSize: 11, fontFamily: "Inter" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) =>
              v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
            }
            width={40}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: "#007aff", strokeWidth: 1, strokeDasharray: "4 4" }}
          />
          <Area
            type="monotone"
            dataKey="income"
            stroke="#007aff"
            strokeWidth={2.5}
            fill="url(#incomeGradient)"
            dot={false}
            activeDot={{
              r: 5,
              fill: "#007aff",
              stroke: "white",
              strokeWidth: 2,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
