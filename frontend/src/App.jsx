import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import MarketplacePage from './pages/MarketplacePage'
import ServicesPage from './pages/ServicesPage'
import BookingsPage from './pages/BookingsPage'
import MyItemsPage from './pages/MyItemsPage'
import MyServicesPage from './pages/MyServicesPage'
import AIModulePage from './pages/AIModulePage'
import AdminPage from './pages/AdminPage'
import NotificationsPage from './pages/NotificationsPage'
import AnalyticsPage from './pages/AnalyticsPage'
import PendingServiceRequestsPage from './pages/PendingServiceRequestsPage'

function PrivateRoute({ children, roles }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" />
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<Navigate to="/dashboard" />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="marketplace" element={<MarketplacePage />} />
            <Route path="services" element={<ServicesPage />} />
            <Route path="bookings" element={<BookingsPage />} />
            <Route path="my-items" element={<MyItemsPage />} />
            <Route path="my-services" element={<PrivateRoute roles={['student','provider','admin']}><MyServicesPage /></PrivateRoute>} />
            <Route path="ai" element={<AIModulePage />} />
            <Route path="analytics" element={<PrivateRoute roles={['provider','admin']}><AnalyticsPage /></PrivateRoute>} />
            <Route path="pending-service-requests" element={<PrivateRoute roles={['provider']}><PendingServiceRequestsPage /></PrivateRoute>} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="admin" element={<PrivateRoute roles={['admin']}><AdminPage /></PrivateRoute>} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
