import { useAuth } from '@/lib/auth-context'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { GudangDashboard } from '@/components/dashboards/gudang-dashboard'
import { LogistikDashboard } from '@/components/dashboards/logistik-dashboard'
import { DealerDashboard } from '@/components/dashboards/dealer-dashboard'
import { ManagerDashboard } from '@/components/dashboards/manager-dashboard'

export default function DashboardPage() {
  const { user } = useAuth()

  const renderDashboard = () => {
    switch (user?.role) {
      case 'gudang':
        return <GudangDashboard />
      case 'logistik':
        return <LogistikDashboard />
      case 'dealer':
        return <DealerDashboard />
      case 'manager':
        return <ManagerDashboard />
      default:
        return <GudangDashboard />
    }
  }

  return (
    <DashboardLayout>
      {renderDashboard()}
    </DashboardLayout>
  )
}
