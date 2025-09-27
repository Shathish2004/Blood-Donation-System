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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, parseISO, differenceInDays } from 'date-fns';
import { LoaderCircle, AlertTriangle, Mail, Phone } from 'lucide-react';
import { getAllInventory } from '@/app/actions';
import { cn } from '@/lib/utils';
import type { BloodUnit, DonationType } from '@/lib/types';
import { Suspense } from 'react';

const getUnitStatus = (expirationDate: string) => {
  const now = new Date();
  const expiry = parseISO(expirationDate);
  const daysLeft = differenceInDays(expiry, now);

  if (daysLeft < 0) {
    return { label: 'Expired', color: 'bg-red-500', icon: <AlertTriangle className="h-3 w-3 mr-1" /> };
  }
  if (daysLeft <= 7) {
    return { label: 'Nearing Expiry', color: 'bg-yellow-500', icon: <AlertTriangle className="h-3 w-3 mr-1" /> };
  }
  return { label: 'Good', color: 'bg-green-500', icon: null };
};

function InventoryOverviewContent() {
  const [inventory, setInventory] = React.useState<BloodUnit[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const allInventory = await getAllInventory();
        setInventory(allInventory);
      } catch (error) {
        console.error("Failed to fetch inventory data", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoaderCircle className="h-8 w-8 animate-spin" />
        <p className="ml-2">Loading all inventory data...</p>
      </div>
    );
  }

  const renderInventoryTable = (donationType: DonationType) => {
    const filteredInventory = inventory.filter(u => u.donationType === donationType);
    const typeLabel = donationType.replace(/_/g, ' ');

    return (
        <Card>
            <CardHeader>
                <CardTitle className="capitalize">{typeLabel} Inventory</CardTitle>
                <CardDescription>A read-only view of all {typeLabel.toLowerCase()} in the system.</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Mobile View */}
              <div className="md:hidden space-y-4">
                {filteredInventory.length > 0 ? (
                  filteredInventory.map((unit) => {
                    const status = getUnitStatus(unit.expirationDate);
                    return (
                      <Card key={unit._id} className="p-4">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                              <p className="font-semibold text-lg">{unit.locationName || unit.location}</p>
                              <div className="text-xs text-muted-foreground mt-2 space-y-1">
                                <p className="flex items-center gap-1"><Mail className="h-3 w-3" /> {unit.locationEmail || 'N/A'}</p>
                                <p className="flex items-center gap-1"><Phone className="h-3 w-3" /> {unit.locationMobile || 'N/A'}</p>
                              </div>
                            </div>
                            <Badge variant="secondary" className={cn('text-white', status.color)}>
                              {status.icon} {status.label}
                            </Badge>
                        </div>
                         <div className="flex justify-between items-center mb-4">
                             <Badge variant="outline" className="text-primary border-primary/50 text-base">{unit.bloodType}</Badge>
                             <p className="text-sm text-muted-foreground">{unit.units} units</p>
                         </div>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="font-medium text-muted-foreground">Collected:</span>
                              <span>{format(parseISO(unit.collectionDate), 'PP')}</span>
                            </div>
                             <div className="flex justify-between">
                              <span className="font-medium text-muted-foreground">Expires:</span>
                              <span>{format(parseISO(unit.expirationDate), 'PP')}</span>
                            </div>
                        </div>
                      </Card>
                    );
                  })
                ) : (
                  <div className="text-center py-10 text-muted-foreground">No {typeLabel.toLowerCase()} inventory found.</div>
                )}
              </div>

              {/* Desktop View */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Facility & Contact</TableHead>
                      <TableHead>Blood Type</TableHead>
                      <TableHead>Units</TableHead>
                      <TableHead>Collection Date</TableHead>
                      <TableHead>Expiration Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInventory.length > 0 ? filteredInventory.map((unit) => {
                      const status = getUnitStatus(unit.expirationDate);
                      return (
                        <TableRow key={unit._id}>
                          <TableCell>
                            <div className="font-medium">{unit.locationName || unit.location}</div>
                            <div className="text-xs text-muted-foreground">{unit.locationEmail || 'N/A'}</div>
                            <div className="text-xs text-muted-foreground">{unit.locationMobile || 'N/A'}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-primary border-primary/50">{unit.bloodType}</Badge>
                          </TableCell>
                          <TableCell>{unit.units}</TableCell>
                          <TableCell>{format(parseISO(unit.collectionDate), 'PP')}</TableCell>
                          <TableCell>{format(parseISO(unit.expirationDate), 'PP')}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={cn('text-white', status.color)}>
                              {status.icon} {status.label}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    }) : (
                       <TableRow>
                          <TableCell colSpan={6} className="h-24 text-center">No {typeLabel.toLowerCase()} inventory found.</TableCell>
                       </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
        </Card>
    );
  }

  return (
    <div className="space-y-6">
        <Tabs defaultValue="whole_blood" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="whole_blood">Whole Blood</TabsTrigger>
              <TabsTrigger value="plasma">Plasma</TabsTrigger>
              <TabsTrigger value="red_blood_cells">Red Blood Cells</TabsTrigger>
            </TabsList>
            <TabsContent value="whole_blood" className="mt-4">{renderInventoryTable('whole_blood')}</TabsContent>
            <TabsContent value="plasma" className="mt-4">{renderInventoryTable('plasma')}</TabsContent>
            <TabsContent value="red_blood_cells" className="mt-4">{renderInventoryTable('red_blood_cells')}</TabsContent>
        </Tabs>
    </div>
  );
}


export default function InventoryOverviewPage() {
    return (
        <Suspense fallback={
            <div className="flex h-full w-full items-center justify-center">
                 <LoaderCircle className="h-8 w-8 animate-spin" />
                 <p className="ml-2">Loading...</p>
            </div>
        }>
            <InventoryOverviewContent />
        </Suspense>
    )
}
