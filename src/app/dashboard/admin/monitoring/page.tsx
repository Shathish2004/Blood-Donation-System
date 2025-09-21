'use client';

import * as React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Droplet,
  Siren,
  Truck,
  LoaderCircle,
  AlertTriangle,
} from 'lucide-react';
import { getSystemStats, getBloodRequestsForUser, getHospitalInventory, getBloodBankInventory } from '@/app/actions';
import { cn } from '@/lib/utils';
import type { BloodUnit, BloodRequest, Urgency } from '@/lib/types';
import { format, parseISO } from 'date-fns';

const urgencyColors: Record<Urgency, string> = {
  Low: 'bg-blue-100 text-blue-800 border-blue-200',
  Medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  High: 'bg-orange-100 text-orange-800 border-orange-200',
  Critical: 'bg-red-100 text-red-800 border-red-200',
};


function SystemMonitoringContent() {
  const [stats, setStats] = React.useState<any>(null);
  const [inventory, setInventory] = React.useState<BloodUnit[]>([]);
  const [requests, setRequests] = React.useState<BloodRequest[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [systemStats, hospitalInv, bankInv, allRequests] = await Promise.all([
          getSystemStats(),
          getHospitalInventory(''), // In a real app, you'd aggregate this
          getBloodBankInventory(''), // Or have a dedicated admin endpoint
          getBloodRequestsForUser(''), // Similar to above
        ]);

        // This is a placeholder for fetching all data since actions are user-specific
        // In a real implementation, new admin-specific actions would be better
        setStats(systemStats);
        
        // For demonstration, we'll just show some data.
        // A real admin panel would need actions to fetch ALL inventory/requests.
        const mockHospitalInv: BloodUnit[] = [{id: "1", bloodType: 'A+', units: 10, collectionDate: new Date().toISOString(), expirationDate: new Date().toISOString(), location: 'City Hospital'}];
        const mockRequests: BloodRequest[] = [{ id: "1", date: new Date().toISOString(), bloodType: 'O-', units: 2, urgency: 'Critical', status: 'Pending', requester: 'County General' }];

        setInventory(mockHospitalInv);
        setRequests(mockRequests);

      } catch (error) {
        console.error("Failed to fetch monitoring data", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const kpiData = [
    { title: 'Total Users', value: stats?.totalUsers, icon: Users },
    { title: 'Total Blood Units', value: stats?.totalUnits, icon: Droplet },
    { title: 'Open Requests', value: stats?.openRequests, icon: Siren },
    { title: 'Total Transfers', value: stats?.totalTransfers, icon: Truck },
  ];

   if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoaderCircle className="h-8 w-8 animate-spin" />
        <p className="ml-2">Loading system data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {kpiData.map((kpi) => (
          <Card key={kpi.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
              <kpi.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value ?? '...'}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Live Inventory Overview</CardTitle>
            <CardDescription>A snapshot of current blood stock levels.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Location</TableHead><TableHead>Blood Type</TableHead><TableHead>Units</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {inventory.map(unit => (
                   <TableRow key={unit.id}>
                     <TableCell>{unit.location}</TableCell>
                     <TableCell><Badge variant="outline">{unit.bloodType}</Badge></TableCell>
                     <TableCell>{unit.units}</TableCell>
                     <TableCell><Badge className="bg-green-500">Good</Badge></TableCell>
                   </TableRow>
                ))}
                 {inventory.length === 0 && <TableRow><TableCell colSpan={4} className="text-center h-24">No inventory data available.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent Urgent Requests</CardTitle>
            <CardDescription>The most recent critical and high-urgency requests.</CardDescription>
          </CardHeader>
          <CardContent>
             <Table>
              <TableHeader><TableRow><TableHead>Requester</TableHead><TableHead>Blood Type</TableHead><TableHead>Units</TableHead><TableHead>Urgency</TableHead></TableRow></TableHeader>
              <TableBody>
                {requests.map(req => (
                   <TableRow key={req.id}>
                     <TableCell>{req.requester}</TableCell>
                     <TableCell><Badge variant="outline">{req.bloodType}</Badge></TableCell>
                     <TableCell>{req.units}</TableCell>
                     <TableCell><Badge variant="outline" className={cn("dark:!text-black", urgencyColors[req.urgency])}>{req.urgency}</Badge></TableCell>
                   </TableRow>
                ))}
                {requests.length === 0 && <TableRow><TableCell colSpan={4} className="text-center h-24">No urgent requests.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function SystemMonitoringPage() {
    return <SystemMonitoringContent />
}
