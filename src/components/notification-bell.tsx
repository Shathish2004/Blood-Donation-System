

'use client';

import * as React from 'react';
import { Bell, HandHeart, CheckCircle, XCircle, Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { getNotificationsForUser, markNotificationAsRead } from '@/app/actions';
import type { Notification } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';

const NOTIFICATION_ICONS: Record<string, React.ElementType> = {
  request: HandHeart,
  response: CheckCircle,
  decline: XCircle,
  offer: Megaphone,
  claim: CheckCircle,
  default: HandHeart,
};

const NOTIFICATION_COLORS: Record<string, string> = {
  request: 'text-primary',
  response: 'text-green-500',
  decline: 'text-red-500',
  offer: 'text-blue-500',
  claim: 'text-green-500',
  default: 'text-primary',
}

export function NotificationBell({ userEmail }: { userEmail: string }) {
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [isOpen, setIsOpen] = React.useState(false);

  const fetchNotifications = React.useCallback(async () => {
    const userNotifications = await getNotificationsForUser(userEmail);
    setNotifications(userNotifications);
    setUnreadCount(userNotifications.filter((n) => !n.read).length);
  }, [userEmail]);

  React.useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000); // Poll every 15 seconds
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open && unreadCount > 0) {
      // Mark all as read when popover opens
      const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
      Promise.all(unreadIds.map(id => markNotificationAsRead(id))).then(() => {
        // We can refetch, or just update the state locally for a faster UI response
        setUnreadCount(0);
        setNotifications(current => current.map(n => ({ ...n, read: true })));
      });
    }
  };
  
  const getIcon = (type?: string) => NOTIFICATION_ICONS[type || 'default'] || NOTIFICATION_ICONS.default;
  const getColor = (type?: string) => NOTIFICATION_COLORS[type || 'default'] || NOTIFICATION_COLORS.default;

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2">
        <div className="flex justify-between items-center px-2 py-1 mb-1">
            <h3 className="font-semibold">Notifications</h3>
            <span className="text-xs text-muted-foreground">{unreadCount > 0 ? `${unreadCount} unread` : 'all read'}</span>
        </div>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {notifications.length > 0 ? (
            notifications.map((notification) => {
               const Icon = getIcon(notification.type);
               const iconColor = getColor(notification.type);
               return (
              <div
                key={notification.id}
                className={`flex items-start gap-3 p-2 rounded-lg ${
                  !notification.read ? 'bg-accent/50' : 'bg-transparent'
                }`}
              >
                <div className={`flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 mt-1 ${iconColor.replace('text-', 'bg-').replace('-500', '/10')}`}>
                    <Icon className={`h-4 w-4 ${iconColor}`} />
                </div>
                <div>
                  <p className="text-sm leading-tight">{notification.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(notification.date), { addSuffix: true })}
                  </p>
                </div>
              </div>
            )})
          ) : (
            <p className="text-center text-sm text-muted-foreground py-4">
              No notifications yet.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
