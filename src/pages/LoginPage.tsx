import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Package, Truck, Building2, BarChart3, Eye, EyeOff, AlertCircle } from 'lucide-react'

const roleIcons = {
  gudang: Package,
  logistik: Truck,
  dealer: Building2,
  manager: BarChart3,
}

const roleLabels = {
  gudang: 'Staff Gudang',
  logistik: 'Staff Logistik',
  dealer: 'Staff Dealer',
  manager: 'Manager',
}

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'gudang' | 'logistik' | 'dealer' | 'manager'>('gudang')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const success = await login(email, password, role)
      if (success) {
        navigate('/dashboard')
      } else {
        setError('Login gagal. Periksa email, password, dan role.')
      }
    } catch {
      setError('Login gagal. Silakan coba lagi.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDemoLogin = async (demoRole: 'gudang' | 'logistik' | 'dealer' | 'manager') => {
    setIsLoading(true)
    setError('')
    try {
      const success = await login(`${demoRole}@supplytrack.com`, 'demo123', demoRole)
      if (success) {
        navigate('/dashboard')
      } else {
        setError('Demo login gagal.')
      }
    } catch {
      setError('Demo login gagal.')
    } finally {
      setIsLoading(false)
    }
  }

  const RoleIcon = roleIcons[role]

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/20 to-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground mb-4">
            <Package className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">SupplyTrack</h1>
          <p className="text-muted-foreground">Sistem Tracking Distribusi Supply Chain</p>
        </div>

        <Card className="border-border/50 shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">Masuk</CardTitle>
            <CardDescription className="text-center">
              Masukkan kredensial Anda untuk mengakses sistem
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-lg">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={role} onValueChange={(value: 'gudang' | 'logistik' | 'dealer' | 'manager') => setRole(value)}>
                  <SelectTrigger>
                    <SelectValue>
                      <div className="flex items-center gap-2">
                        <RoleIcon className="w-4 h-4" />
                        {roleLabels[role]}
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(roleLabels) as Array<keyof typeof roleLabels>).map((r) => {
                      const Icon = roleIcons[r]
                      return (
                        <SelectItem key={r} value={r}>
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4" />
                            {roleLabels[r]}
                          </div>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="nama@perusahaan.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Masukkan password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Memproses...' : 'Masuk'}
              </Button>
            </form>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Demo Login</span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                {(Object.keys(roleLabels) as Array<keyof typeof roleLabels>).map((r) => {
                  const Icon = roleIcons[r]
                  return (
                    <Button
                      key={r}
                      variant="outline"
                      size="sm"
                      onClick={() => handleDemoLogin(r)}
                      disabled={isLoading}
                      className="flex items-center gap-2"
                    >
                      <Icon className="w-4 h-4" />
                      {roleLabels[r]}
                    </Button>
                  )
                })}
              </div>
              <p className="text-xs text-muted-foreground text-center mt-3">
                Password demo: demo123
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
