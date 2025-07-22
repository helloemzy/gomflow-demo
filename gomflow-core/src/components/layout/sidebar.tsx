"use client";

import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  Users,
  CreditCard,
  BarChart3,
  Settings,
  Plus,
  Search,
  MessageSquare,
  Bell,
  ShoppingCart,
  History,
  User,
  Globe,
  Target,
  TrendingUp,
  UserPlus,
  Zap
} from "lucide-react";

interface SidebarProps {
  userType: 'gom' | 'buyer' | 'admin';
  isOpen: boolean;
  onClose: () => void;
}

const gomNavItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    description: "Overview & analytics"
  },
  {
    title: "Orders",
    href: "/orders",
    icon: Package,
    description: "Manage your group orders"
  },
  {
    title: "Create Order",
    href: "/orders/create",
    icon: Plus,
    description: "Start a new group order"
  },
  {
    title: "Submissions",
    href: "/submissions",
    icon: Users,
    description: "Track buyer submissions"
  },
  {
    title: "Payments",
    href: "/payments",
    icon: CreditCard,
    description: "Payment tracking & analytics"
  },
  {
    title: "Analytics",
    href: "/analytics",
    icon: BarChart3,
    description: "Sales & performance insights"
  },
  {
    title: "Predictive Analytics",
    href: "/predictive-analytics",
    icon: TrendingUp,
    description: "AI-powered forecasting"
  },
  {
    title: "Market Intelligence",
    href: "/market-intelligence",
    icon: Target,
    description: "Real-time market insights"
  },
  {
    title: "Messages",
    href: "/messages",
    icon: MessageSquare,
    description: "Buyer communications"
  },
  {
    title: "Collaboration",
    href: "/collaboration",
    icon: UserPlus,
    description: "Team workspace & collaboration"
  }
];

const buyerNavItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    description: "Your order overview"
  },
  {
    title: "Browse Orders",
    href: "/browse",
    icon: Search,
    description: "Find group orders"
  },
  {
    title: "My Orders",
    href: "/my-orders",
    icon: ShoppingCart,
    description: "Track your submissions"
  },
  {
    title: "Order History",
    href: "/history",
    icon: History,
    description: "Past orders & receipts"
  },
  {
    title: "Payments",
    href: "/payments",
    icon: CreditCard,
    description: "Payment status & methods"
  },
  {
    title: "Notifications",
    href: "/notifications",
    icon: Bell,
    description: "Order updates & alerts"
  },
  {
    title: "Collaboration",
    href: "/collaboration",
    icon: UserPlus,
    description: "Team workspace access"
  }
];

const adminNavItems = [
  {
    title: "Admin Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
    description: "Platform overview"
  },
  {
    title: "All Orders",
    href: "/admin/orders",
    icon: Package,
    description: "Monitor all orders"
  },
  {
    title: "Users",
    href: "/admin/users",
    icon: Users,
    description: "Manage GOMs & buyers"
  },
  {
    title: "Analytics",
    href: "/admin/analytics",
    icon: BarChart3,
    description: "Platform insights"
  },
  {
    title: "System",
    href: "/admin/system",
    icon: Settings,
    description: "System configuration"
  },
  {
    title: "Collaboration",
    href: "/collaboration",
    icon: UserPlus,
    description: "Platform collaboration overview"
  }
];

export function Sidebar({ userType, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const navItems = userType === 'gom' ? gomNavItems : 
                   userType === 'buyer' ? buyerNavItems : 
                   adminNavItems;

  const handleNavigation = (href: string) => {
    router.push(href);
    if (window.innerWidth < 1024) {
      onClose();
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-200">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">G</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">GOMFLOW</h1>
          </div>

          {/* User type indicator */}
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center gap-2">
              {userType === 'gom' && <Globe className="h-4 w-4 text-primary-600" />}
              {userType === 'buyer' && <User className="h-4 w-4 text-secondary-600" />}
              {userType === 'admin' && <Settings className="h-4 w-4 text-red-600" />}
              <span className="text-sm font-medium text-gray-900 capitalize">
                {userType === 'gom' ? 'Group Order Manager' : 
                 userType === 'buyer' ? 'Buyer Account' : 
                 'Administrator'}
              </span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              
              return (
                <Button
                  key={item.href}
                  variant="ghost"
                  className={cn(
                    "w-full justify-start h-auto p-3 text-left",
                    isActive 
                      ? "bg-primary-50 text-primary-700 border-r-2 border-primary-600" 
                      : "text-gray-700 hover:bg-gray-50"
                  )}
                  onClick={() => handleNavigation(item.href)}
                >
                  <Icon className={cn(
                    "h-5 w-5 mr-3 flex-shrink-0",
                    isActive ? "text-primary-600" : "text-gray-400"
                  )} />
                  <div className="flex flex-col">
                    <span className="font-medium">{item.title}</span>
                    <span className="text-xs text-gray-500 mt-0.5">
                      {item.description}
                    </span>
                  </div>
                </Button>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200">
            <Button
              variant="ghost"
              className="w-full justify-start text-gray-700 hover:bg-gray-50"
              onClick={() => handleNavigation("/settings")}
            >
              <Settings className="h-5 w-5 mr-3 text-gray-400" />
              <div className="flex flex-col text-left">
                <span className="font-medium">Settings</span>
                <span className="text-xs text-gray-500 mt-0.5">
                  Account & preferences
                </span>
              </div>
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}