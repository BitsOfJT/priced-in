import type { BtcObservation, CpiObservation, DataEnvelope } from '../types'

async function request<T>(path: string): Promise<DataEnvelope<T>> {
  const response = await fetch(path)
  const payload = await response.json() as DataEnvelope<T>
  if (!response.ok) throw new Error(payload.message ?? 'Data source is unavailable')
  return payload
}

export const getStatus = () => request<{ alphaVantageConfigured: boolean; providers: Record<string, string> }>('/api/status')
export const getSpot = () => request<{ price: number; change24h?: number }>('/api/btc/spot')
export const getBtcHistory = (start: string, end: string) => request<BtcObservation[]>(`/api/btc/history?start=${start}&end=${end}`)
export const getCpiHistory = (startYear: number, endYear: number) => request<CpiObservation[]>(`/api/cpi/history?startYear=${startYear}&endYear=${endYear}`)
export type StockObservation = { month: string; adjustedClose: number; close: number }
export const getStockHistory = (ticker: string) => request<StockObservation[]>(`/api/stocks/${encodeURIComponent(ticker)}`)
