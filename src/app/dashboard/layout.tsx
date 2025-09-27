
'use client';

import * as React from 'react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarInset,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import {
  Droplet,
  HeartHandshake,
  LayoutGrid,
  Building,
  TestTube2,
  User,
  LogOut,
  LoaderCircle,
  FileClock,
  UserCheck,
  LifeBuoy,
  Users,
  Search,
  Settings,
  ShieldQuestion,
  FlaskConical,
  History,
  Home,
  Truck,
  Package,
  Megaphone,
  AreaChart,
  ShieldBan,
  LineChart,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { getUser, User as DbUser } from '@/app/actions';
import { NotificationBell } from '@/components/notification-bell';
import { Suspense } from 'react';

type Role = 'Donor' | 'Individual' | 'Hospital' | 'Blood Bank' | 'Admin';

const allMenuItems = [
  // Admin
  {
    href: '/dashboard',
    label: 'Overview',
    icon: LayoutGrid,
    roles: ['Admin'] as Role[],
  },
   {
    href: '/dashboard/admin/user-management',
    label: 'User Management',
    icon: Users,
    roles: ['Admin'] as Role[],
  },
  {
    href: '/dashboard/admin/monitoring',
    label: 'System Monitoring',
    icon: AreaChart,
    roles: ['Admin'] as Role[],
  },
  {
    href: '/dashboard/admin/inventory',
    label: 'Inventory Overview',
    icon: Package,
    roles: ['Admin'] as Role[],
  },
  {
    href: '/dashboard/admin/forecasting',
    label: 'Demand Forecasting',
    icon: LineChart,
    roles: ['Admin'] as Role[],
  },
  // Donor
  {
    href: '/dashboard/donor',
    label: 'Availability',
    icon: UserCheck,
    roles: ['Donor'] as Role[],
    view: 'availability',
  },
  {
    href: '/dashboard/donor',
    label: 'Request Status & Responses',
    icon: ShieldQuestion,
    roles: ['Donor'] as Role[],
    view: 'requests',
  },
    {
    href: '/dashboard/donor',
    label: 'Find Donors',
    icon: Search,
    roles: ['Donor'] as Role[],
    view: 'find-donors',
  },
  {
    href: '/dashboard/donor',
    label: 'Donation History',
    icon: History,
    roles: ['Donor'] as Role[],
    view: 'history',
  },
  {
    href: '/dashboard/donor',
    label: 'My Profile',
    icon: Settings,
    roles: ['Donor'] as Role[],
    view: 'profile',
  },
  // Individual
  {
    href: '/dashboard/requester',
    label: 'Request Blood',
    icon: LifeBuoy,
    roles: ['Individual'] as Role[],
    view: 'request',
  },
   {
    href: '/dashboard/requester',
    label: 'Request Status',
    icon: ShieldQuestion,
    roles: ['Individual'] as Role[],
    view: 'incoming-requests',
  },
  {
    href: '/dashboard/requester',
    label: 'Find Donors',
    icon: Search,
    roles: ['Individual'] as Role[],
    view: 'donors',
  },
  {
    href: '/dashboard/requester',
    label: 'My Profile',
    icon: Settings,
    roles: ['Individual'] as Role[],
    view: 'profile',
  },
  // Hospital
  {
    href: '/dashboard/hospital',
    label: 'Inventory',
    icon: Home,
    roles: ['Hospital'] as Role[],
    view: 'inventory',
  },
  {
    href: '/dashboard/hospital',
    label: 'Request Status & Responses',
    icon: ShieldQuestion,
    roles: ['Hospital'] as Role[],
    view: 'requests',
  },
  {
    href: '/dashboard/hospital',
    label: 'AI Analysis',
    icon: FlaskConical,
    roles: ['Hospital'] as Role[],
    view: 'analysis',
  },
  {
    href: '/dashboard/hospital',
    label: 'Request Facility',
    icon: Building,
    roles: ['Hospital'] as Role[],
    view: 'facility-requests',
  },
  {
    href: '/dashboard/hospital',
    label: 'Find Donors',
    icon: Users,
    roles: ['Hospital'] as Role[],
    view: 'find-donors',
  },
  {
    href: '/dashboard/hospital',
    label: 'Blood Polls',
    icon: Megaphone,
    roles: ['Hospital'] as Role[],
    view: 'polls',
  },
  {
    href: '/dashboard/hospital',
    label: 'Request History',
    icon: History,
    roles: ['Hospital'] as Role[],
    view: 'history',
  },
  {
    href: '/dashboard/hospital',
    label: 'Transfer History',
    icon: Truck,
    roles: ['Hospital'] as Role[],
    view: 'transfer-history',
  },
  {
    href: '/dashboard/hospital',
    label: 'Received History',
    icon: Package,
    roles: ['Hospital'] as Role[],
    view: 'received-history',
  },
  // Blood Bank
  {
    href: '/dashboard/blood-bank',
    label: 'Inventory',
    icon: Home,
    roles: ['Blood Bank'] as Role[],
    view: 'inventory',
  },
  {
    href: '/dashboard/blood-bank',
    label: 'Request Status & Responses',
    icon: ShieldQuestion,
    roles: ['Blood Bank'] as Role[],
    view: 'requests',
  },
  {
    href: '/dashboard/blood-bank',
    label: 'Request Facility',
    icon: Building,
    roles: ['Blood Bank'] as Role[],
    view: 'facility-requests',
  },
  {
    href: '/dashboard/blood-bank',
    label: 'Blood Polls',
    icon: Megaphone,
    roles: ['Blood Bank'] as Role[],
    view: 'polls',
  },
  {
    href: '/dashboard/blood-bank',
    label: 'AI Analysis',
    icon: FlaskConical,
    roles: ['Blood Bank'] as Role[],
    view: 'analysis',
  },
  {
    href: '/dashboard/blood-bank',
    label: 'Request History',
    icon: History,
    roles: ['Blood Bank'] as Role[],
    view: 'request-history',
  },
  {
    href: '/dashboard/blood-bank',
    label: 'Transfer History',
    icon: Truck,
    roles: ['Blood Bank'] as Role[],
    view: 'transfer-history',
  },
   {
    href: '/dashboard/blood-bank',
    label: 'Received History',
    icon: Package,
    roles: ['Blood Bank'] as Role[],
    view: 'received-history',
  },
];

const rolePageMap: Record<Role, string> = {
    'Donor': '/dashboard/donor',
    'Individual': '/dashboard/requester',
    'Hospital': '/dashboard/hospital',
    'Blood Bank': '/dashboard/blood-bank',
    'Admin': '/dashboard',
}

const roleLabelMap: Record<Role, string> = {
    'Donor': 'Donor',
    'Individual': 'Individual',
    'Hospital': 'Hospital',
    'Blood Bank': 'Blood Bank',
    'Admin': 'Admin',
}

function DashboardLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentView = searchParams.get('view');
  const [user, setUser] = React.useState<DbUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const { setOpen } = useSidebar();

  React.useEffect(() => {
    const fetchUser = async () => {
      const email = sessionStorage.getItem('currentUserEmail');
      if (email) {
        try {
          if (email === 'admin@bloodnet.com') {
              setUser({
                  email: 'admin@bloodnet.com',
                  role: 'Admin',
                  name: 'Administrator',
              });
          } else {
            const userData = await getUser(email);
            setUser(userData);
          }
        } catch (e) {
          console.error(e);
          router.push('/login');
        }
      } else {
        // If no email, redirect to login
        router.push('/login');
      }
      setLoading(false);
    };

    fetchUser();
  }, [router]);

  const currentRole = user?.role as Role | undefined;

  React.useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  const menuItems = React.useMemo(() => {
    if (!currentRole) return [];
    return allMenuItems.filter(item => item.roles.includes(currentRole));
  }, [currentRole]);

  const handleLogout = () => {
    sessionStorage.removeItem('currentUserEmail');
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <LoaderCircle className="h-8 w-8 animate-spin" />
        <p className="ml-2">Loading dashboard...</p>
      </div>
    );
  }
  
  if (!user || !currentRole) {
    return null; // Redirect is handled by useEffect
  }
  
  const getPageTitle = () => {
      const mainItem = roleLabelMap[currentRole] || 'Dashboard';
      
      const subItem = menuItems.find(item => {
          const viewMatches = item.view ? item.view === currentView : !currentView;
          // Exact match for admin pages
          if (currentRole === 'Admin') {
              return item.href === pathname;
          }
          return item.href === pathname && viewMatches;
      });

      // Default to first item in menu if no view is selected for a multi-view page
      if (!subItem && (pathname.startsWith('/dashboard/'))) {
          const defaultSubItem = menuItems.find(item => item.href === pathname);
          return defaultSubItem?.label || mainItem;
      }

      return subItem?.label || mainItem;
  }


  return (
      <div className="relative flex min-h-screen">
        <Sidebar>
          <SidebarHeader className="p-4">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Droplet className="h-6 w-6" />
              </div>
              <span className="text-lg font-semibold text-sidebar-foreground">
                BloodNet
              </span>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={`${item.href}-${item.view || 'default'}`}>
                  <Link href={`${item.href}${item.view ? `?view=${item.view}` : ''}`} passHref>
                    <SidebarMenuButton
                      onClick={() => setOpen(false)}
                      isActive={pathname === item.href && (currentRole !== 'Admin' ? (item.view ? currentView === item.view : !currentView) : true)}
                      tooltip={item.label}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter className="p-4">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarImage src="https://picsum.photos/seed/avatar/40/40" alt="User" />
                <AvatarFallback>{user.name?.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col text-sm truncate">
                <span className="font-semibold text-sidebar-foreground truncate">
                  {user.name}
                </span>
                <span className="text-muted-foreground truncate">{user.email}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout} className="ml-auto text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>
        <div className="flex flex-1 flex-col">
          <header className="flex h-16 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 sm:px-6 sticky top-0 z-40">
            <SidebarTrigger />
            <h1 className="text-xl font-semibold font-headline">
              {getPageTitle()}
            </h1>
            <div className="ml-auto">
              {user && user.role !== 'Admin' && <NotificationBell userEmail={user.email} />}
            </div>
          </header>
          <main className="flex-1 p-4 sm:p-6">
            {children}
          </main>
        </div>
      </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
      <SidebarProvider>
        <Suspense fallback={
            <div className="flex h-screen w-full items-center justify-center">
                <LoaderCircle className="h-8 w-8 animate-spin" />
                <p className="ml-2">Loading...</p>
            </div>
        }>
            <DashboardLayoutContent>{children}</DashboardLayoutContent>
        </Suspense>
      </SidebarProvider>
    )
}
