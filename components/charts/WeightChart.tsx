'use client'

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip as ChartTooltip,
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, ChartTooltip)

/* eslint-disable @typescript-eslint/no-explicit-any */

interface WeightChartProps {
  data: any
  options: any
}

export default function WeightChart({ data, options }: WeightChartProps) {
  return (
    <div style={{ position: 'relative', height: 160 }}>
      <Line data={data} options={options} />
    </div>
  )
}
