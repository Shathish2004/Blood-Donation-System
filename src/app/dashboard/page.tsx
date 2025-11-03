import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ArrowRight,
  Droplet,
  HeartHandshake,
  Siren,
  Users,
} from 'lucide-react';
import Link from 'next/link';

const kpiData = [
  {
    title: 'Available Units',
    value: '1,254',
    change: '+12.5%',
    description: 'Total blood units across all banks',
    icon: Droplet,
  },
  {
    title: 'Active Donors',
    value: '8,421',
    change: '+5.2%',
    description: 'Donors available in the last 90 days',
    icon: HeartHandshake,
  },
  {
    title: 'Open Requests',
    value: '78',
    change: '-3.1%',
    description: 'Urgent and pending blood requests',
    icon: Siren,
  },
  {
    title: 'Lives Saved',
    value: '22,930',
    change: '+201 this month',
    description: 'Estimated lives saved through donations',
    icon: Users,
  },
];

const quickLinks = [
  { href: '/dashboard/admin/user-management', title: 'Manage Users', description: 'View, ban, or delete users' },
  { href: '/dashboard/admin/monitoring', title: 'System Monitoring', description: 'Check system health and stats' },
  { href: '/dashboard/admin/inventory', title: 'Inventory Overview', description: 'View all blood units in the system' },
  { href: '/dashboard/admin/forecasting', title: 'Demand Forecasting', description: 'Run AI-powered demand analysis' },
];

export default function OverviewPage() {
  return (
    <div className="space-y-8">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {kpiData.map((kpi) => (
          <Card key={kpi.title} className="shadow-md transition-transform hover:scale-105 hover:shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
              <kpi.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
              <p className="text-xs text-muted-foreground">{kpi.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Get started with common tasks right away.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {quickLinks.map(link => (
              <Link href={link.href} passHref key={link.href}>
                <Button variant="outline" className="w-full justify-between h-auto py-3">
                  <div>
                    <p className="font-semibold">{link.title}</p>
                    <p className="text-sm text-muted-foreground text-left">{link.description}</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-primary" />
                </Button>
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
             <CardDescription>
              A log of the most recent events in the system.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
                <div className="flex items-start gap-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/50">
                        <Droplet className="h-4 w-4 text-green-600 dark:text-green-400"/>
                    </div>
                    <div className="text-sm">
                        <p className="font-medium">New donation from Donor #4821</p>
                        <p className="text-muted-foreground">2 units of O+ received at City General.</p>
                        <p className="text-xs text-muted-foreground mt-1">2 minutes ago</p>
                    </div>
                </div>
                <div className="flex items-start gap-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/50">
                        <Siren className="h-4 w-4 text-red-600 dark:text-red-400"/>
                    </div>
                    <div className="text-sm">
                        <p className="font-medium">Critical request for AB-</p>
                        <p className="text-muted-foreground">County Medical Center requests 4 units.</p>
                         <p className="text-xs text-muted-foreground mt-1">15 minutes ago</p>
                    </div>
                </div>
                 <div className="flex items-start gap-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50">
                        <Users className="h-4 w-4 text-blue-600 dark:text-blue-400"/>
                    </div>
                    <div className="text-sm">
                        <p className="font-medium">Request #REQ789 Fulfilled</p>
                        <p className="text-muted-foreground">2 units of B+ dispatched to St. Jude's.</p>
                         <p className="text-xs text-muted-foreground mt-1">1 hour ago</p>
                    </div>
                </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
