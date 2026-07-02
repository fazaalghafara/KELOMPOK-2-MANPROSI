import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/lib/auth-context'
import { NotificationProvider } from '@/lib/notification-context'
import LoginPage from '@/src/pages/LoginPage'
import DashboardPage from '@/src/pages/DashboardPage'
import InventoryPage from '@/src/pages/InventoryPage'
import ShipmentPage from '@/src/pages/ShipmentPage'
import TrackingPage from '@/src/pages/TrackingPage'
import ReturnsPage from '@/src/pages/ReturnsPage'
import DocumentsPage from '@/src/pages/DocumentsPage'
import ReportsPage from '@/src/pages/ReportsPage'
import SalesOrderPage from '@/src/pages/SalesOrderPage'
import GoodsReceiptPage from '@/src/pages/GoodsReceiptPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }
  
  if (!user) {
    return <Navigate to="/" replace />
  }
  
  return <>{children}</>
}

function AppRoutes() {
  const { user } = useAuth()
  
  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/inventory" element={<ProtectedRoute><InventoryPage /></ProtectedRoute>} />
      <Route path="/shipment" element={<ProtectedRoute><ShipmentPage /></ProtectedRoute>} />
      <Route path="/tracking" element={<ProtectedRoute><TrackingPage /></ProtectedRoute>} />
      <Route path="/returns" element={<ProtectedRoute><ReturnsPage /></ProtectedRoute>} />
      <Route path="/documents" element={<ProtectedRoute><DocumentsPage /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
      <Route path="/sales-orders" element={<ProtectedRoute><SalesOrderPage /></ProtectedRoute>} />
      <Route path="/goods-receipts" element={<ProtectedRoute><GoodsReceiptPage /></ProtectedRoute>} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <AppRoutes />
      </NotificationProvider>
    </AuthProvider>
  )
}
