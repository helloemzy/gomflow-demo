"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Bell,
  BellRing,
  X,
  Check,
  CheckCheck,
  Search,
  Filter,
  Settings,
  MessageSquare,
  Users,
  Package,
  CreditCard,
  AlertTriangle,
  Info,
  TrendingUp,
  Clock,
  ChevronRight,
  ExternalLink,
  Volume2,
  VolumeX,
  Smartphone,
  Mail,
  Monitor
} from "lucide-react";

interface NotificationItem {
  id: string;
  type: 'chat' | 'activity' | 'order' | 'payment' | 'system' | 'collaboration';
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  isImportant: boolean;
  userId?: string;
  userName?: string;
  userAvatar?: string;
  actionUrl?: string;
  actionText?: string;
  metadata?: Record<string, any>;
}

interface NotificationCenterProps {
  notifications: NotificationItem[];
  unreadCount: number;
  onMarkAsRead: (ids: string[]) => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  onNotificationClick: (notification: NotificationItem) => void;
  className?: string;
  position?: 'left' | 'right' | 'center';
  showAsDropdown?: boolean;
  maxHeight?: string;
}

const notificationTypes = {
  chat: {
    icon: MessageSquare,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200'
  },
  activity: {
    icon: TrendingUp,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200'
  },
  order: {
    icon: Package,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200'
  },
  payment: {
    icon: CreditCard,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200'
  },
  system: {
    icon: Settings,
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200'
  },
  collaboration: {
    icon: Users,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200'
  }
};

export function NotificationCenter({
  notifications,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll,
  onNotificationClick,
  className,
  position = 'right',
  showAsDropdown = true,
  maxHeight = '500px'
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState({
    sound: true,
    push: true,
    email: true,
    desktop: true
  });
  const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredNotifications = notifications.filter(notification => {
    const matchesSearch = notification.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         notification.message.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === 'all' || notification.type === selectedType;
    const matchesRead = !showUnreadOnly || !notification.isRead;
    
    return matchesSearch && matchesType && matchesRead;
  });

  const handleNotificationClick = (notification: NotificationItem) => {
    if (!notification.isRead) {
      onMarkAsRead([notification.id]);
    }
    onNotificationClick(notification);
    setIsOpen(false);
  };

  const handleSelectNotification = (notificationId: string) => {
    const newSelected = new Set(selectedNotifications);
    if (newSelected.has(notificationId)) {
      newSelected.delete(notificationId);
    } else {
      newSelected.add(notificationId);
    }
    setSelectedNotifications(newSelected);
  };

  const handleBulkMarkAsRead = () => {
    const selectedIds = Array.from(selectedNotifications);
    onMarkAsRead(selectedIds);
    setSelectedNotifications(new Set());
  };

  const getRelativeTime = (timestamp: string) => {
    const now = new Date();
    const past = new Date(timestamp);
    const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return past.toLocaleDateString();
  };

  const renderNotificationItem = (notification: NotificationItem) => {
    const typeConfig = notificationTypes[notification.type];
    const Icon = typeConfig?.icon || Bell;
    const isSelected = selectedNotifications.has(notification.id);

    return (
      <div
        key={notification.id}
        className={cn(
          "relative p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors",
          !notification.isRead && "bg-blue-50 border-blue-100",
          notification.isImportant && "border-l-4 border-l-red-500",
          isSelected && "bg-blue-100"
        )}
        onClick={() => handleNotificationClick(notification)}
      >
        <div className="flex items-start space-x-3">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              handleSelectNotification(notification.id);
            }}
            className="mt-1"
          />
          
          <div className={cn(
            "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
            typeConfig?.bgColor,
            typeConfig?.borderColor,
            "border"
          )}>
            <Icon className={cn("h-5 w-5", typeConfig?.color)} />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <h3 className={cn(
                  "text-sm font-medium",
                  notification.isRead ? "text-gray-900" : "text-gray-900"
                )}>
                  {notification.title}
                </h3>
                {notification.isImportant && (
                  <Badge variant="destructive" className="text-xs">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Important
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-500">
                  {getRelativeTime(notification.timestamp)}
                </span>
                {!notification.isRead && (
                  <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                )}
              </div>
            </div>
            
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
              {notification.message}
            </p>
            
            {notification.userName && (
              <div className="flex items-center space-x-2 mt-2">
                <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-xs font-medium">
                  {notification.userName.charAt(0)}
                </div>
                <span className="text-xs text-gray-500">{notification.userName}</span>
              </div>
            )}
            
            {notification.actionUrl && (
              <div className="mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-primary-600 hover:text-primary-700 p-0 h-auto"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(notification.actionUrl, '_blank');
                  }}
                >
                  {notification.actionText || 'View Details'}
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderNotificationList = () => (
    <div className={cn("bg-white rounded-lg shadow-lg border border-gray-200", className)}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Notifications
            {unreadCount > 0 && (
              <Badge className="ml-2 bg-primary-600">{unreadCount}</Badge>
            )}
          </h2>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onMarkAllAsRead}
              disabled={unreadCount === 0}
              className="text-primary-600 hover:text-primary-700"
            >
              <CheckCheck className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearAll}
              className="text-gray-600 hover:text-gray-700"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 border-b border-gray-200 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search notifications..."
            className="pl-10"
          />
        </div>
        
        <div className="flex items-center space-x-4">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm"
          >
            <option value="all">All Types</option>
            {Object.entries(notificationTypes).map(([key, config]) => (
              <option key={key} value={key}>
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </option>
            ))}
          </select>
          
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={showUnreadOnly}
              onChange={(e) => setShowUnreadOnly(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-gray-700">Unread only</span>
          </label>
        </div>
        
        {selectedNotifications.size > 0 && (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">
              {selectedNotifications.size} selected
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBulkMarkAsRead}
              className="text-primary-600 hover:text-primary-700"
            >
              Mark as Read
            </Button>
          </div>
        )}
      </div>

      {/* Notifications List */}
      <div className="overflow-y-auto" style={{ maxHeight }}>
        {filteredNotifications.length > 0 ? (
          filteredNotifications.map(renderNotificationItem)
        ) : (
          <div className="p-8 text-center text-gray-500">
            <Bell className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium">No notifications</p>
            <p className="text-sm">You're all caught up!</p>
          </div>
        )}
      </div>

      {/* Settings Footer */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setNotificationSettings(prev => ({ ...prev, sound: !prev.sound }))}
              className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900"
            >
              {notificationSettings.sound ? (
                <Volume2 className="h-4 w-4" />
              ) : (
                <VolumeX className="h-4 w-4" />
              )}
              <span>Sound</span>
            </button>
            
            <button
              onClick={() => setNotificationSettings(prev => ({ ...prev, push: !prev.push }))}
              className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900"
            >
              <Smartphone className="h-4 w-4" />
              <span>Push</span>
            </button>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-600 hover:text-gray-700"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  if (showAsDropdown) {
    return (
      <div className="relative" ref={dropdownRef}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          className="relative text-gray-600 hover:text-gray-900"
        >
          <BellRing className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 text-xs bg-primary-600">
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
        
        {isOpen && (
          <div className={cn(
            "absolute top-full mt-2 w-96 z-50",
            position === 'left' && "left-0",
            position === 'right' && "right-0",
            position === 'center' && "left-1/2 transform -translate-x-1/2"
          )}>
            {renderNotificationList()}
          </div>
        )}
      </div>
    );
  }

  return renderNotificationList();
}

export default NotificationCenter;