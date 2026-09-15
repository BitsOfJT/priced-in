import type { ComparisonResult } from '../types'
import { monthLabel } from './calculations'

const copper = '#d68448'
const ivory = '#fff8ed'
const ink = '#180f0a'

export function downloadBudgetCard(result: ComparisonResult, includeCategories: boolean, historyMode: 'estimated' | 'recorded' = 'estimated') {
  if (!result.start || !result.end) return
  const canvas = document.createElement('canvas')
  canvas.width = 1200; canvas.height = 630
  const context = canvas.getContext('2d')
  if (!context) return
  context.fillStyle = ink; context.fillRect(0, 0, 1200, 630)
  context.fillStyle = copper; context.fillRect(0, 0, 12, 630)
  context.fillStyle = ivory; context.font = '500 27px ui-monospace, monospace'; context.fillText(`PRICED IN  /  ${historyMode === 'recorded' ? 'RECORDED BUDGET' : 'ESTIMATED SAME BASKET'}`, 70, 80)
  context.font = '600 66px Georgia, serif'; context.fillText('The same life, priced in bitcoin.', 70, 157)
  const points = result.points
  const x = (index: number) => 70 + index / Math.max(points.length - 1, 1) * 1060
  const range = Math.max(...points.flatMap((point) => [point.dollarIndex ?? 0, point.bitcoinIndex ?? 0]), 130)
  const y = (value: number) => 430 - (value - 70) / (range - 70) * 210
  context.lineWidth = 5
  ;([{ key: 'dollarIndex', color: ivory }, { key: 'bitcoinIndex', color: copper }] as const).forEach(({ key, color }) => {
    context.strokeStyle = color; context.beginPath(); let drawing = false
    points.forEach((point, index) => { const value = point[key]; if (value === null) { drawing = false; return } if (!drawing) { context.moveTo(x(index), y(value)); drawing = true } else context.lineTo(x(index), y(value)) }); context.stroke()
  })
  context.font = '500 22px ui-monospace, monospace'; context.fillStyle = ivory
  context.fillText(`${monthLabel(result.start.month)} → ${monthLabel(result.end.month)}`, 70, 490)
  context.fillStyle = copper; context.fillText(`Bitcoin cost ${result.bitcoinChange !== null ? result.bitcoinChange.toFixed(1) : '—'}%`, 70, 530)
  context.fillStyle = ivory; context.fillText(`Dollar cost ${result.dollarChange !== null ? result.dollarChange.toFixed(1) : '—'}%`, 430, 530)
  context.fillStyle = '#baa999'; context.font = '400 16px ui-monospace, monospace'
  context.fillText(`Sources: BLS CPI + Coinbase BTC/USD. ${includeCategories ? 'Category detail included in app.' : 'Aggregate totals.'}`, 70, 582)
  canvas.toBlob((blob) => { if (!blob) return; const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `priced-in-${result.end?.month ?? 'comparison'}.png`; link.click(); URL.revokeObjectURL(url) }, 'image/png')
}
