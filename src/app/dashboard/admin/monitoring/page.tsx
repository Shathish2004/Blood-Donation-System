
'use client';
export const dynamic = 'force-dynamic';

import * as React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
  Sparkles,
} from 'lucide-react';
import {
  getSystemStats,
  getBloodRequestsForUser,
  getHospitalInventory,
  getBloodBankInventory,
  findInventoryMatches,
} from '@/app/actions';
import { cn } from '@/lib/utils';
import type { BloodUnit, BloodRequest, Urgency } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { useForm, SubmitHandler } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';

const urgencyColors: Record<Urgency, string> = {
  Low: 'bg-blue-100 text-blue-800 border-blue-200',
  Medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  High: 'bg-orange-100 text-orange-800 border-orange-200',
  Critical: 'bg-red-100 text-red-800 border-red-200',
};

const inventoryMatchingSchema = z.object({
  hospitalRequests: z.string().min(20, { message: 'Request data is too short.' }),
  bloodBankInventory: z.string().min(20, { message: 'Inventory data is too short.' }),
});
type InventoryMatchingFormValues = z.infer<typeof inventoryMatchingSchema>;


function SystemMonitoringContent() {
  const { toast } = useToast();
  const [stats, setStats] = React.useState<any>(null);
  const [inventory, setInventory] = React.useState<BloodUnit[]>([]);
  const [requests, setRequests] = React.useState<BloodRequest[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [inventoryMatchingResult, setInventoryMatchingResult] = React.useState<string | null>(null);

  const inventoryMatchingForm = useForm<InventoryMatchingFormValues>({
    resolver: zodResolver(inventoryMatchingSchema),
    defaultValues: {
        hospitalRequests: 'City General Hospital: 5 units of A+, 2 units of O-. Urgency: High.\nCounty Medical: 3 units of B+. Urgency: Medium.',
        bloodBankInventory: 'Blood Bank Alpha: A+ (50 units, expires in 30 days), O- (20 units, expires in 25 days), B+ (40 units, expires in 35 days).'
    }
  });

  const onInventoryMatchingSubmit: SubmitHandler<InventoryMatchingFormValues> = async (data) => {
    try {
      const result = await findInventoryMatches(data);
      setInventoryMatchingResult(result.matches);
       toast({
        title: 'AI Analysis Complete!',
        description: 'Matching analysis has been generated.',
      });
    } catch (error) {
       toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not perform analysis. Please try again.',
      });
    }
  };

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
        const mockHospitalInv: BloodUnit[] = [{_id: "1", bloodType: 'A+', units: 10, collectionDate: new Date().toISOString(), expirationDate: new Date().toISOString(), location: 'City Hospital', donationType: 'whole_blood'}];
        const mockRequests: BloodRequest[] = [{ _id: "1", date: new Date().toISOString(), bloodType: 'O-', units: 2, urgency: 'Critical', status: 'Pending', requester: 'County General', donationType: 'whole_blood' }];

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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Live Inventory Overview</CardTitle>
            <CardDescription>A snapshot of current blood stock levels.</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Mobile View */}
            <div className="space-y-4 md:hidden">
              {inventory.length > 0 ? (
                inventory.map(unit => (
                  <Card key={unit._id} className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-semibold">{unit.location}</p>
                      <Badge className="bg-green-500">Good</Badge>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <Badge variant="outline">{unit.bloodType}</Badge>
                      <p>{unit.units} units</p>
                    </div>
                  </Card>
                ))
              ) : (
                <div className="text-center h-24 flex items-center justify-center text-muted-foreground">No inventory data available.</div>
              )}
            </div>

            {/* Desktop View */}
            <div className="hidden md:block">
              <Table>
                <TableHeader><TableRow><TableHead>Location</TableHead><TableHead>Blood Type</TableHead><TableHead>Units</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {inventory.map(unit => (
                    <TableRow key={unit._id}>
                      <TableCell>{unit.location}</TableCell>
                      <TableCell><Badge variant="outline">{unit.bloodType}</Badge></TableCell>
                      <TableCell>{unit.units}</TableCell>
                      <TableCell><Badge className="bg-green-500">Good</Badge></TableCell>
                    </TableRow>
                  ))}
                  {inventory.length === 0 && <TableRow><TableCell colSpan={4} className="text-center h-24">No inventory data available.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent Urgent Requests</CardTitle>
            <CardDescription>The most recent critical and high-urgency requests.</CardDescription>
          </CardHeader>
          <CardContent>
             {/* Mobile View */}
            <div className="space-y-4 md:hidden">
              {requests.length > 0 ? (
                requests.map(req => (
                  <Card key={req._id} className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-semibold">{req.requester}</p>
                       <Badge variant="outline" className={cn("dark:!text-black", urgencyColors[req.urgency])}>{req.urgency}</Badge>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <Badge variant="outline">{req.bloodType}</Badge>
                      <p>{req.units} units</p>
                    </div>
                  </Card>
                ))
              ) : (
                 <div className="text-center h-24 flex items-center justify-center text-muted-foreground">No urgent requests.</div>
              )}
            </div>
             {/* Desktop View */}
            <div className="hidden md:block">
              <Table>
                <TableHeader><TableRow><TableHead>Requester</TableHead><TableHead>Blood Type</TableHead><TableHead>Units</TableHead><TableHead>Urgency</TableHead></TableRow></TableHeader>
                <TableBody>
                  {requests.map(req => (
                    <TableRow key={req._id}>
                      <TableCell>{req.requester}</TableCell>
                      <TableCell><Badge variant="outline">{req.bloodType}</Badge></TableCell>
                      <TableCell>{req.units}</TableCell>
                      <TableCell><Badge variant="outline" className={cn("dark:!text-black", urgencyColors[req.urgency])}>{req.urgency}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {requests.length === 0 && <TableRow><TableCell colSpan={4} className="text-center h-24">No urgent requests.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-md">
        <Form {...inventoryMatchingForm}>
          <form onSubmit={inventoryMatchingForm.handleSubmit(onInventoryMatchingSubmit)}>
             <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="text-accent" />
                AI Inventory Match Analysis
              </CardTitle>
              <CardDescription>
                Analyze hospital requests against inventory to find matches.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <FormField
                    control={inventoryMatchingForm.control}
                    name="hospitalRequests"
                    render={({ field }) => (<FormItem><FormLabel>Hospital Blood Requests</FormLabel><FormControl><Textarea placeholder="Paste hospital request data here..." {...field} rows={5}/></FormControl><FormDescription>Include blood type, units, and urgency.</FormDescription><FormMessage /></FormItem>)}
                />
                <FormField
                    control={inventoryMatchingForm.control}
                    name="bloodBankInventory"
                    render={({ field }) => (<FormItem><FormLabel>Blood Bank Inventory</FormLabel><FormControl><Textarea placeholder="Paste blood bank inventory data here..." {...field} rows={5} /></FormControl><FormDescription>Include blood type, units, and expiration dates.</FormDescription><FormMessage /></FormItem>)}
                />
            </CardContent>
            <CardFooter className="flex-col items-start gap-4">
                 <Button type="submit" disabled={inventoryMatchingForm.formState.isSubmitting}>
                    {inventoryMatchingForm.formState.isSubmitting && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                    Analyze & Match
                </Button>
                {inventoryMatchingForm.formState.isSubmitting && !inventoryMatchingResult && (
                    <div className="w-full text-center p-4">
                        <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-primary" />
                        <p className="text-muted-foreground mt-2">AI is analyzing the data...</p>
                    </div>
                )}
                {inventoryMatchingResult && (
                    <Card className="w-full bg-accent/30">
                        <CardHeader><CardTitle className="text-base">AI Match Analysis</CardTitle></CardHeader>
                        <CardContent className="text-sm prose dark:prose-invert max-w-none">
                           <pre className="whitespace-pre-wrap font-sans bg-transparent p-0">{inventoryMatchingResult}</pre>
                        </CardContent>
                    </Card>
                )}
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}

export default function SystemMonitoringPage() {
    return <SystemMonitoringContent />
}
