import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, getOrderStatus } from "@/lib/utils";
import { Calendar, Users, DollarSign, Clock } from "lucide-react";

interface OrderCardProps {
  order: {
    id: string;
    title: string;
    description?: string;
    price: number;
    currency: 'PHP' | 'MYR';
    deadline: string;
    total_submissions: number;
    min_orders: number;
    max_orders?: number;
    is_active: boolean;
    created_at: string;
    gom?: {
      username: string;
      rating?: number;
    };
  };
  variant?: 'gom' | 'buyer';
  onAction?: (action: string, orderId: string) => void;
}

export function OrderCard({ order, variant = 'buyer', onAction }: OrderCardProps) {
  const status = getOrderStatus(order);
  const progress = order.min_orders ? (order.total_submissions / order.min_orders) * 100 : 0;
  const daysLeft = Math.ceil((new Date(order.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  
  const statusConfig = {
    active: { label: 'Active', color: 'bg-green-100 text-green-800' },
    confirmed: { label: 'Confirmed', color: 'bg-blue-100 text-blue-800' },
    expired: { label: 'Expired', color: 'bg-red-100 text-red-800' },
    closed: { label: 'Closed', color: 'bg-gray-100 text-gray-800' }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold text-gray-900 line-clamp-2">
              {order.title}
            </CardTitle>
            {order.gom && variant === 'buyer' && (
              <p className="text-sm text-gray-600 mt-1">
                by @{order.gom.username}
                {order.gom.rating && (
                  <span className="ml-2 text-yellow-500">
                    ★ {order.gom.rating.toFixed(1)}
                  </span>
                )}
              </p>
            )}
          </div>
          <Badge className={statusConfig[status as keyof typeof statusConfig].color}>
            {statusConfig[status as keyof typeof statusConfig].label}
          </Badge>
        </div>
        {order.description && (
          <p className="text-sm text-gray-600 line-clamp-2">{order.description}</p>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Price and deadline */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-gray-400" />
            <span className="font-semibold text-gray-900">
              {formatCurrency(order.price, order.currency)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <span className={daysLeft <= 1 ? "text-red-600 font-medium" : "text-gray-600"}>
              {daysLeft > 0 ? `${daysLeft} days left` : 'Expired'}
            </span>
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-400" />
              <span className="text-gray-600">Progress</span>
            </div>
            <span className="font-medium text-gray-900">
              {order.total_submissions}/{order.min_orders} min
              {order.max_orders && ` (${order.max_orders} max)`}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all ${
                progress >= 100 ? 'bg-green-500' : 
                progress >= 75 ? 'bg-blue-500' : 
                progress >= 50 ? 'bg-yellow-500' : 'bg-gray-400'
              }`}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <div className="text-xs text-gray-500">
            {progress >= 100 ? 'Minimum reached!' : `${Math.round(progress)}% of minimum`}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {variant === 'buyer' ? (
            <>
              <Button 
                size="sm" 
                className="flex-1"
                onClick={() => onAction?.('view', order.id)}
              >
                View Details
              </Button>
              {status === 'active' && (
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => onAction?.('submit', order.id)}
                >
                  Submit Order
                </Button>
              )}
            </>
          ) : (
            <>
              <Button 
                size="sm" 
                variant="outline" 
                className="flex-1"
                onClick={() => onAction?.('manage', order.id)}
              >
                Manage
              </Button>
              <Button 
                size="sm" 
                onClick={() => onAction?.('analytics', order.id)}
              >
                Analytics
              </Button>
            </>
          )}
        </div>

        {/* Created date */}
        <div className="flex items-center gap-2 text-xs text-gray-500 pt-2 border-t border-gray-100">
          <Clock className="h-3 w-3" />
          Created {formatDate(order.created_at)}
        </div>
      </CardContent>
    </Card>
  );
}