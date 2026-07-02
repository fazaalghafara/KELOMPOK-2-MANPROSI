import { useEffect, useState } from 'react'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Download, TrendingUp, TrendingDown, Package, Truck, RotateCcw } from 'lucide-react'
import { api, type ReportsSummary } from '@/src/lib/api'

const COLORS = ['oklch(0.50 0.18 250)', 'oklch(0.65 0.18 145)', 'oklch(0.75 0.15 75)', 'oklch(0.60 0.20 300)', 'oklch(0.55 0.22 25)', 'oklch(0.45 0.10 200)']

type Period = '1month' | '3months' | '6months' | '1year'

export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>('6months')
  const [data, setData] = useState<ReportsSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setIsLoading(true)
    setError('')
    api.reports.summary(period)
      .then(setData)
      .catch(() => setError('Gagal memuat data laporan. Pastikan backend dan database aktif.'))
      .finally(() => setIsLoading(false))
  }, [period])

  const handleExport = () => {
    if (!data) return
    const header = ['Bulan', 'Barang Masuk', 'Barang Keluar', 'Retur']
    const rows = data.monthlyMovement.map((row) => [row.month, String(row.masuk), String(row.keluar), String(row.retur)])
    const csv = [header, ...rows].map((row) => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `laporan-${period}-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const renderTrend = (value: number) => {
    const isPositive = value >= 0
    return (
      <div className={`flex items-center gap-1 mt-1 text-sm ${isPositive ? 'text-success' : 'text-destructive'}`}>
        {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
        <span>{isPositive ? '+' : ''}{value}%</span>
      </div>
    )
  }

  const summary = data?.summary
  const monthlyData = data?.monthlyMovement || []
  const shipmentData = data?.shipmentPerformance || []
  const categoryData = data?.categoryDistribution || []

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Laporan & Analitik</h1>
            <p className="text-muted-foreground">Analisis performa dan statistik dari data terkini</p>
          </div>
          <div className="flex gap-2">
            <Select value={period} onValueChange={(value: Period) => setPeriod(value)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1month">1 Bulan</SelectItem>
                <SelectItem value="3months">3 Bulan</SelectItem>
                <SelectItem value="6months">6 Bulan</SelectItem>
                <SelectItem value="1year">1 Tahun</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleExport} disabled={!data}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {error && (
          <Card>
            <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Barang Masuk</p>
                  <p className="text-2xl font-bold">{isLoading ? '...' : (summary?.totalIncoming ?? 0).toLocaleString('id-ID')}</p>
                  {!isLoading && summary && renderTrend(summary.incomingGrowth)}
                </div>
                <div className="p-3 rounded-lg bg-success/10">
                  <Package className="w-6 h-6 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Barang Keluar</p>
                  <p className="text-2xl font-bold">{isLoading ? '...' : (summary?.totalOutgoing ?? 0).toLocaleString('id-ID')}</p>
                  {!isLoading && summary && renderTrend(summary.outgoingGrowth)}
                </div>
                <div className="p-3 rounded-lg bg-primary/10">
                  <Truck className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Retur</p>
                  <p className="text-2xl font-bold">{isLoading ? '...' : (summary?.totalReturns ?? 0).toLocaleString('id-ID')}</p>
                  {!isLoading && summary && renderTrend(summary.returnsGrowth)}
                </div>
                <div className="p-3 rounded-lg bg-warning/10">
                  <RotateCcw className="w-6 h-6 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="inventory" className="space-y-4">
          <TabsList>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="shipment">Pengiriman</TabsTrigger>
          </TabsList>

          <TabsContent value="inventory" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Pergerakan Barang</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] flex items-center justify-center">
                    {isLoading ? (
                      <p className="text-sm text-muted-foreground">Memuat data...</p>
                    ) : monthlyData.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Belum ada data transaksi gudang.</p>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis dataKey="month" className="text-muted-foreground" />
                          <YAxis className="text-muted-foreground" />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'oklch(var(--card))',
                              border: '1px solid oklch(var(--border))',
                              borderRadius: '8px',
                            }}
                          />
                          <Legend />
                          <Bar dataKey="masuk" fill="oklch(0.65 0.18 145)" name="Barang Masuk" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="keluar" fill="oklch(0.50 0.18 250)" name="Barang Keluar" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Trend Retur</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] flex items-center justify-center">
                    {isLoading ? (
                      <p className="text-sm text-muted-foreground">Memuat data...</p>
                    ) : monthlyData.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Belum ada data retur.</p>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={monthlyData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis dataKey="month" className="text-muted-foreground" />
                          <YAxis className="text-muted-foreground" />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'oklch(var(--card))',
                              border: '1px solid oklch(var(--border))',
                              borderRadius: '8px',
                            }}
                          />
                          <Area type="monotone" dataKey="retur" stroke="oklch(0.55 0.22 25)" fill="oklch(0.55 0.22 25 / 0.2)" name="Retur" />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Distribusi Kategori (Stok Saat Ini)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center h-[300px]">
                  {isLoading ? (
                    <p className="text-sm text-muted-foreground">Memuat data...</p>
                  ) : categoryData.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Belum ada data inventory.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {categoryData.map((_entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="shipment" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Performa Pengiriman</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] flex items-center justify-center">
                  {isLoading ? (
                    <p className="text-sm text-muted-foreground">Memuat data...</p>
                  ) : shipmentData.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Belum ada data pengiriman.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={shipmentData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="month" className="text-muted-foreground" />
                        <YAxis className="text-muted-foreground" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'oklch(var(--card))',
                            border: '1px solid oklch(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="onTime" stroke="oklch(0.65 0.18 145)" strokeWidth={2} name="Tepat Waktu (%)" />
                        <Line type="monotone" dataKey="delayed" stroke="oklch(0.55 0.22 25)" strokeWidth={2} name="Terlambat (%)" />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ringkasan Pengiriman Bulanan</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bulan</TableHead>
                      <TableHead className="text-right">Tepat Waktu</TableHead>
                      <TableHead className="text-right">Terlambat</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-6">Memuat data...</TableCell>
                      </TableRow>
                    ) : shipmentData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-6">Belum ada data pengiriman.</TableCell>
                      </TableRow>
                    ) : shipmentData.map((data) => (
                      <TableRow key={data.month}>
                        <TableCell className="font-medium">{data.month}</TableCell>
                        <TableCell className="text-right text-success">{data.onTime}%</TableCell>
                        <TableCell className="text-right text-destructive">{data.delayed}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>
    </DashboardLayout>
  )
}
