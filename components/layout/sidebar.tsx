import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth, UserRole } from "@/lib/auth-context";
import {
  LayoutDashboard,
  Package,
  Truck,
  MapPin,
  FileText,
  RotateCcw,
  BarChart3,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Box,
  ShoppingCart,
  PackageCheck,
} from "lucide-react";
import { useState } from "react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles: UserRole[];
}

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: <LayoutDashboard className="h-5 w-5" />,
    roles: ["gudang", "logistik", "dealer", "manager"],
  },
  {
    label: "Inventory",
    href: "/inventory",
    icon: <Package className="h-5 w-5" />,
    roles: ["gudang", "manager"],
  },
  {
    label: "Shipment",
    href: "/shipment",
    icon: <Truck className="h-5 w-5" />,
    roles: ["gudang", "logistik", "manager"],
  },
  {
    label: "Tracking",
    href: "/tracking",
    icon: <MapPin className="h-5 w-5" />,
    // Gap #3 fix: gudang perlu lihat status pengiriman masuk/keluar (WBS 1.15)
    roles: ["gudang", "logistik", "dealer", "manager"],
  },
  {
    label: "Documents",
    href: "/documents",
    icon: <FileText className="h-5 w-5" />,
    roles: ["gudang", "dealer", "manager"],
  },
  {
    label: "Returns",
    href: "/returns",
    icon: <RotateCcw className="h-5 w-5" />,
    roles: ["gudang", "dealer", "manager"],
  },
  {
    label: "Sales Order",
    href: "/sales-orders",
    icon: <ShoppingCart className="h-5 w-5" />,
    roles: ["dealer", "gudang", "manager"],
  },
  {
    label: "Penerimaan Barang",
    href: "/goods-receipts",
    icon: <PackageCheck className="h-5 w-5" />,
    roles: ["dealer", "gudang", "manager"],
  },
  {
    label: "Reports",
    href: "/reports",
    icon: <BarChart3 className="h-5 w-5" />,
    roles: ["manager"],
  },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const filteredNavItems = navItems.filter(
    (item) => user && item.roles.includes(user.role)
  );

  const getRoleLabel = (role: UserRole) => {
    const labels: Record<UserRole, string> = {
      gudang: "Staff Gudang",
      logistik: "Staff Logistik",
      dealer: "Staff Dealer",
      manager: "Manager",
    };
    return labels[role];
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <aside
      className={cn(
        "flex flex-col h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border">
        <Link to="/dashboard" className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-sidebar-primary">
            <Box className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="font-semibold text-lg">SupplyTrack</span>
          )}
        </Link>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg hover:bg-sidebar-accent transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* User Info */}
      {user && !collapsed && (
        <div className="px-4 py-4 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-sidebar-accent flex items-center justify-center text-sm font-medium">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.name}</p>
              <p className="text-xs text-sidebar-muted truncate">
                {getRoleLabel(user.role)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {filteredNavItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              {item.icon}
              {!collapsed && <span className="text-sm">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-sidebar-border">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        >
          <LogOut className="h-5 w-5" />
          {!collapsed && <span className="text-sm">Logout</span>}
        </button>
      </div>
    </aside>
  );
}
