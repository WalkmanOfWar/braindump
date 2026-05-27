'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import { cn } from '@/lib/utils'

interface ReviewPoint {
  dayOffset: number   // days since today
  retention: number   // 0–100
  label?: string
}

interface ForgettingCurveChartProps {
  /** FSRS stability values (one per card) */
  stabilities: number[]
  /** Review timestamps for the deck (ISO strings) */
  reviewDates?: string[]
  className?: string
}

/** Ebbinghaus retention: R = e^(-t/S) × 100 */
function retention(daysSinceReview: number, stability: number): number {
  if (stability <= 0) return 100
  return Math.round(Math.exp(-daysSinceReview / stability) * 100)
}

/** Average stability across all cards (0 if none) */
function avgStability(stabilities: number[]): number {
  if (!stabilities.length) return 0
  return stabilities.reduce((a, b) => a + b, 0) / stabilities.length
}

export function ForgettingCurveChart({ stabilities, reviewDates = [], className }: ForgettingCurveChartProps) {
  const S = avgStability(stabilities)
  if (S === 0) return null

  // Build curve: day 0 → 30
  const curveData = Array.from({ length: 31 }, (_, i) => ({
    day: i,
    retention: retention(i, S),
  }))

  // Map review dates onto the curve as markers
  const now = Date.now()
  const reviewPoints: ReviewPoint[] = reviewDates.map((iso) => {
    const dayOffset = Math.round((now - new Date(iso).getTime()) / 86_400_000)
    return {
      dayOffset: Math.max(0, Math.min(30, dayOffset)),
      retention: retention(dayOffset, S),
      label: 'powtórka',
    }
  })

  // Target retention line at 90%
  const TARGET = 90

  return (
    <div className={cn('w-full', className)}>
      <p className="text-xs text-muted-foreground mb-2">
        Krzywa zapominania Ebbinghausa · średnia stabilność{' '}
        <span className="font-medium text-foreground">{S.toFixed(1)} dni</span>
      </p>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={curveData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            tickFormatter={(v: number) => `${v}d`}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Tooltip
            formatter={(v: unknown) => [`${v}%`, 'Retencja']}
            labelFormatter={(d: unknown) => `Dzień ${d}`}
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: '1px solid hsl(var(--border))',
              background: 'hsl(var(--card))',
              color: 'hsl(var(--foreground))',
            }}
          />
          <ReferenceLine
            y={TARGET}
            stroke="hsl(var(--primary))"
            strokeDasharray="4 4"
            strokeWidth={1.5}
            label={{ value: '90%', position: 'right', fontSize: 10, fill: 'hsl(var(--primary))' }}
          />
          {reviewPoints.map((rp, i) => (
            <ReferenceLine
              key={i}
              x={rp.dayOffset}
              stroke="hsl(var(--green-500, 34 197 94))"
              strokeWidth={1.5}
              strokeDasharray="3 3"
            />
          ))}
          <Line
            type="monotone"
            dataKey="retention"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-[10px] text-muted-foreground mt-1 text-center">
        Linia przerywana = cel 90% retencji · pionowe linie = daty powtórek
      </p>
    </div>
  )
}
