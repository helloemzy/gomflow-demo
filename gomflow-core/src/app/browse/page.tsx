"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { OrderCard } from "@/components/dashboard/order-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Filter,
  Package,
  SortAsc,
  SortDesc,
  TrendingUp,
  Clock,
  MapPin,
  Star
} from "lucide-react";

export default function BrowsePage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("trending");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);
  
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    const fetchPublicOrders = async () => {
      try {
        // Fetch all active orders (public endpoint)
        const response = await fetch('/api/orders/public');
        
        if (response.ok) {
          const data = await response.json();
          // Only show active orders that haven't expired
          const activeOrders = data.data.filter((order: any) => 
            order.is_active && new Date(order.deadline) > new Date()
          );
          setOrders(activeOrders);
          setFilteredOrders(activeOrders);
        }
      } catch (error) {
        console.error('Error fetching public orders:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPublicOrders();
  }, []);

  useEffect(() => {
    let filtered = [...orders];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(order =>
        order.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.gom_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Category filter
    if (categoryFilter !== "all") {
      filtered = filtered.filter(order => order.category === categoryFilter);
    }

    // Country filter
    if (countryFilter !== "all") {
      filtered = filtered.filter(order => order.shipping_from === countryFilter);
    }

    // Price range filter
    filtered = filtered.filter(order => 
      order.price >= priceRange[0] && order.price <= priceRange[1]
    );

    // Sort
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case "trending":
          // Sort by submission rate and recency
          const aScore = (a.submission_count / Math.max(1, Math.ceil((new Date().getTime() - new Date(a.created_at).getTime()) / (1000 * 60 * 60 * 24)))) * 100;
          const bScore = (b.submission_count / Math.max(1, Math.ceil((new Date().getTime() - new Date(b.created_at).getTime()) / (1000 * 60 * 60 * 24)))) * 100;
          aValue = aScore;
          bValue = bScore;
          break;
        case "deadline":
          aValue = new Date(a.deadline);
          bValue = new Date(b.deadline);
          break;
        case "price":
          aValue = a.price;
          bValue = b.price;
          break;
        case "progress":
          aValue = a.submission_count / a.min_orders;
          bValue = b.submission_count / b.min_orders;
          break;
        case "newest":
          aValue = new Date(a.created_at);
          bValue = new Date(b.created_at);
          break;
        default:
          aValue = new Date(a.created_at);
          bValue = new Date(b.created_at);
      }

      if (sortOrder === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredOrders(filtered);
  }, [orders, searchTerm, categoryFilter, countryFilter, priceRange, sortBy, sortOrder]);

  const handleOrderAction = (action: string, orderId: string) => {
    switch (action) {
      case 'view':
      case 'submit':
        router.push(`/orders/${orderId}`);
        break;
    }
  };

  const getTimeRemaining = (deadline: string) => {
    const now = new Date();
    const end = new Date(deadline);
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 0) return "Expired";
    if (diffDays === 1) return "1 day left";
    if (diffDays <= 7) return `${diffDays} days left`;
    return `${Math.ceil(diffDays / 7)} weeks left`;
  };

  const getProgressInfo = (order: any) => {
    const progress = (order.submission_count / order.min_orders) * 100;
    const isNearGoal = progress >= 80;
    const isGoalReached = progress >= 100;
    
    return {
      percentage: Math.min(progress, 100),
      isNearGoal,
      isGoalReached,
      remaining: Math.max(0, order.min_orders - order.submission_count)
    };
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Browse Group Orders</h1>
          <p className="text-gray-600">
            Discover active group orders from trusted GOMs across Southeast Asia
          </p>
        </div>

        {/* Trending/Featured Section */}
        {filteredOrders.length > 0 && (
          <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Trending Now</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {filteredOrders.slice(0, 3).map((order) => {
                  const progress = getProgressInfo(order);
                  return (
                    <div 
                      key={order.id}
                      className="bg-white rounded-lg p-4 border cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => router.push(`/orders/${order.id}`)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-medium text-sm line-clamp-2">{order.title}</h3>
                        <Badge variant="outline" className="text-xs">
                          {order.category}
                        </Badge>
                      </div>
                      <div className="text-lg font-bold text-primary mb-2">
                        {order.currency === 'PHP' ? '₱' : 'RM'}{order.price}
                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>{order.submission_count}/{order.min_orders} orders</span>
                        <span>{getTimeRemaining(order.deadline)}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1 mt-2">
                        <div 
                          className={`h-1 rounded-full ${progress.isGoalReached ? 'bg-green-500' : progress.isNearGoal ? 'bg-orange-500' : 'bg-blue-500'}`}
                          style={{ width: `${progress.percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters and Search */}
        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Search */}
              <div className="relative lg:col-span-2">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search orders, GOMs, or categories..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Category Filter */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 border border-input bg-background rounded-md text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="all">All Categories</option>
                <option value="album">Album</option>
                <option value="merchandise">Merchandise</option>
                <option value="photocard">Photocard</option>
                <option value="fashion">Fashion</option>
                <option value="collectible">Collectible</option>
                <option value="other">Other</option>
              </select>

              {/* Country Filter */}
              <select
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value)}
                className="px-3 py-2 border border-input bg-background rounded-md text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="all">All Countries</option>
                <option value="Philippines">Philippines</option>
                <option value="Malaysia">Malaysia</option>
                <option value="South Korea">South Korea</option>
                <option value="Japan">Japan</option>
                <option value="Other">Other</option>
              </select>

              {/* Sort */}
              <div className="flex gap-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="flex-1 px-3 py-2 border border-input bg-background rounded-md text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="trending">Trending</option>
                  <option value="deadline">Deadline</option>
                  <option value="newest">Newest</option>
                  <option value="price">Price</option>
                  <option value="progress">Progress</option>
                </select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                >
                  {sortOrder === "asc" ? (
                    <SortAsc className="h-4 w-4" />
                  ) : (
                    <SortDesc className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Price Range Filter */}
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700 min-w-[80px]">Price Range:</span>
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={priceRange[0]}
                    onChange={(e) => setPriceRange([parseInt(e.target.value) || 0, priceRange[1]])}
                    className="w-20"
                  />
                  <span>-</span>
                  <Input
                    type="number"
                    placeholder="Max"
                    value={priceRange[1]}
                    onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value) || 1000])}
                    className="w-20"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPriceRange([0, 1000])}
                  >
                    Reset
                  </Button>
                </div>
              </div>
            </div>

            {/* Active filters display */}
            <div className="flex flex-wrap gap-2 mt-4">
              {searchTerm && (
                <Badge variant="outline" className="cursor-pointer" onClick={() => setSearchTerm("")}>
                  Search: {searchTerm} ×
                </Badge>
              )}
              {categoryFilter !== "all" && (
                <Badge variant="outline" className="cursor-pointer" onClick={() => setCategoryFilter("all")}>
                  Category: {categoryFilter} ×
                </Badge>
              )}
              {countryFilter !== "all" && (
                <Badge variant="outline" className="cursor-pointer" onClick={() => setCountryFilter("all")}>
                  Country: {countryFilter} ×
                </Badge>
              )}
              {(priceRange[0] !== 0 || priceRange[1] !== 1000) && (
                <Badge variant="outline" className="cursor-pointer" onClick={() => setPriceRange([0, 1000])}>
                  Price: {priceRange[0]} - {priceRange[1]} ×
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Summary Stats */}
        {filteredOrders.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-primary">{filteredOrders.length}</div>
                <div className="text-sm text-gray-600">Available Orders</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-green-600">
                  {filteredOrders.filter(o => getProgressInfo(o).isGoalReached).length}
                </div>
                <div className="text-sm text-gray-600">Goal Reached</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {filteredOrders.filter(o => getTimeRemaining(o.deadline).includes('day')).length}
                </div>
                <div className="text-sm text-gray-600">Ending Soon</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-purple-600">
                  ₱{filteredOrders.reduce((sum, o) => sum + (o.price * o.submission_count), 0).toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">Total Value</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Orders Grid */}
        {filteredOrders.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredOrders.map((order) => {
              const progress = getProgressInfo(order);
              const timeRemaining = getTimeRemaining(order.deadline);
              
              return (
                <div key={order.id} className="relative">
                  <OrderCard
                    order={order}
                    variant="buyer"
                    onAction={handleOrderAction}
                  />
                  <div className="absolute top-4 right-4 flex flex-col gap-1">
                    {progress.isGoalReached && (
                      <Badge className="bg-green-500">
                        Goal Reached
                      </Badge>
                    )}
                    {progress.isNearGoal && !progress.isGoalReached && (
                      <Badge className="bg-orange-500">
                        Almost There
                      </Badge>
                    )}
                    {timeRemaining.includes('day') && (
                      <Badge variant="destructive">
                        <Clock className="h-3 w-3 mr-1" />
                        {timeRemaining}
                      </Badge>
                    )}
                  </div>
                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="bg-white/90 backdrop-blur-sm rounded-lg p-2 border">
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>{order.submission_count}/{order.min_orders} orders</span>
                        <span>{progress.percentage.toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1">
                        <div 
                          className={`h-1 rounded-full transition-all ${
                            progress.isGoalReached ? 'bg-green-500' : 
                            progress.isNearGoal ? 'bg-orange-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${progress.percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {orders.length === 0 
                  ? 'No active orders available'
                  : 'No orders match your filters'
                }
              </h3>
              <p className="text-gray-500 mb-4">
                {orders.length === 0
                  ? 'Check back later for new group orders from GOMs.'
                  : 'Try adjusting your search criteria or filters.'
                }
              </p>
              {orders.length > 0 && (
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSearchTerm("");
                    setCategoryFilter("all");
                    setCountryFilter("all");
                    setPriceRange([0, 1000]);
                  }}
                >
                  Clear All Filters
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Load More (for pagination in future) */}
        {filteredOrders.length > 0 && filteredOrders.length >= 12 && (
          <div className="text-center">
            <Button variant="outline">
              Load More Orders
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}