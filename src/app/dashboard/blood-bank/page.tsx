'use client';
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
import { Button } from '@/components/ui/button';
import { format, parseISO, differenceInDays, formatDistanceToNow } from 'date-fns';
import {
  Truck,
  Package,
  PlusCircle,
  Pencil,
  Trash2,
  LoaderCircle,
  AlertTriangle,
  Calendar as CalendarIcon,
  Send,
  Check,
  X,
  Megaphone,
  Building,
} from 'lucide-react';
import { AIForms } from './ai-forms';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { bloodTypes } from '@/lib/data';
import { addBloodUnitToBank, deleteBloodUnitFromBank, getBloodBankInventory, getBloodRequestsForUser, getNotificationsForUser, getPotentialDonors, getUser, User, respondToRequest, declineRequest, createDirectBloodRequest, addTransfer, getSentTransfers, getReceivedTransfers, createBloodOffer, getBloodOffers, claimBloodOffer, cancelBloodOffer } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import type { BloodUnit, Notification, Urgency, BloodRequest, Transfer, BloodOffer } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm, SubmitHandler } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';


const unitSchema = z.object({
  bloodType: z.string().nonempty("Blood type is required."),
  units: z.coerce.number().min(1, "At least one unit is required."),
  collectionDate: z.date({ required_error: "Collection date is required." }),
});
type UnitFormValues = z.infer<typeof unitSchema>;

const directRequestSchema = z.object({
    bloodType: z.string().nonempty({ message: 'Blood type is required.' }),
    units: z.coerce.number().min(1, 'At least 1 unit is required.'),
    urgency: z.enum(['Low', 'Medium', 'High', 'Critical']),
});
type DirectRequestFormValues = z.infer<typeof directRequestSchema>;

const transferSchema = z.object({
    destination: z.string().min(3, "Destination is required."),
    bloodType: z.string().nonempty("Blood type is required."),
    units: z.coerce.number().min(1, "At least one unit is required."),
});
type TransferFormValues = z.infer<typeof transferSchema>;

const receivedSchema = z.object({
    source: z.string().min(3, "Source is required."),
    bloodType: z.string().nonempty("Blood type is required."),
    units: z.coerce.number().min(1, "At least one unit is required."),
});
type ReceivedFormValues = z.infer<typeof receivedSchema>;

const offerSchema = z.object({
    bloodType: z.string().nonempty("Blood type is required."),
    units: z.coerce.number().min(1, "At least one unit is required."),
    message: z.string().optional(),
});
type OfferFormValues = z.infer<typeof offerSchema>;


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

const urgencyColors: Record<Urgency, string> = {
  Low: 'bg-blue-100 text-blue-800 border-blue-200',
  Medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  High: 'bg-orange-100 text-orange-800 border-orange-200',
  Critical: 'bg-red-100 text-red-800 border-red-200',
};

function DeclineRequestDialog({ notification, onConfirm }: { notification: Notification, onConfirm: (reason: string) => void }) {
    const [reason, setReason] = useState('');
    const [open, setOpen] = useState(false);

    const handleConfirm = () => {
        onConfirm(reason);
        setOpen(false);
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <X className="mr-1 h-4 w-4" /> Decline
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Decline Request</DialogTitle>
                    <DialogDescription>
                        Please provide a reason for declining this request. This will be shared with the requester.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Textarea 
                        placeholder="e.g., Currently unavailable, Not a match, etc." 
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                    />
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button variant="destructive" onClick={handleConfirm} disabled={!reason}>Confirm Decline</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function DirectRequestDialog({
    requester,
    recipient,
    onSuccess,
}: {
    requester: User;
    recipient: User;
    onSuccess: () => void;
}) {
    const { toast } = useToast();
    const [open, setOpen] = useState(false);
    const form = useForm<DirectRequestFormValues>({
        resolver: zodResolver(directRequestSchema),
        defaultValues: {
            units: 1,
            urgency: 'Medium',
            bloodType: recipient.role === 'Donor' ? recipient.bloodType : (recipient.availableBloodTypes && recipient.availableBloodTypes.length > 0 ? recipient.availableBloodTypes[0] : ''),
        },
    });

    const onSubmit: SubmitHandler<DirectRequestFormValues> = async (data) => {
        try {
            const result = await createDirectBloodRequest({
                requester: requester,
                recipient: recipient,
                ...data,
            });
            if (result.success) {
                toast({ title: 'Request Sent!', description: result.message });
                onSuccess();
                setOpen(false);
                form.reset();
            } else {
                throw new Error(result.message);
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message || 'Failed to send direct request.' });
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" disabled={!recipient.availableBloodTypes && recipient.role !== 'Donor'}>
                    <Send className="mr-2 h-3 w-3" />
                    Request
                </Button>
            </DialogTrigger>
            <DialogContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                        <DialogHeader>
                            <DialogTitle>Send Direct Request to {recipient.name}</DialogTitle>
                            <DialogDescription>
                                Specify the details of your blood request.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-4">
                            <FormField
                                control={form.control}
                                name="bloodType"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Blood Type</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={recipient.role === 'Donor'}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select blood type" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {recipient.role === 'Donor' && recipient.bloodType ? (
                                                    <SelectItem value={recipient.bloodType}>{recipient.bloodType}</SelectItem>
                                                ) : (
                                                    recipient.availableBloodTypes?.map((type) => (
                                                        <SelectItem key={type} value={type}>{type}</SelectItem>
                                                    ))
                                                )}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="units"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Units</FormLabel>
                                        <FormControl>
                                            <Input type="number" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="urgency"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Urgency</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select urgency" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {(['Low', 'Medium', 'High', 'Critical'] as Urgency[]).map(level => (
                                                    <SelectItem key={level} value={level}>{level}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <DialogFooter>
                             <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/> : "Send Request"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

function AddEditUnitDialog({ unit, bankEmail, onSave }: { unit?: BloodUnit, bankEmail: string, onSave: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const form = useForm<UnitFormValues>({
    resolver: zodResolver(unitSchema),
    defaultValues: unit ? {
      bloodType: unit.bloodType,
      units: unit.units,
      collectionDate: parseISO(unit.collectionDate)
    } : {
      units: 1,
      collectionDate: new Date(),
    }
  });

  const onSubmit: SubmitHandler<UnitFormValues> = async (data) => {
    try {
      const unitData = { ...data, collectionDate: data.collectionDate.toISOString() };
      // The blood bank page does not support editing yet, only adding.
      // A full implementation would require an `updateBloodUnitInBank` action.
      if (unit) {
        // await updateBloodUnitInBank(unit.id, unitData);
        toast({ title: 'Note', description: 'Editing is not yet implemented for blood banks.' });
      } else {
        await addBloodUnitToBank(unitData, bankEmail);
        toast({ title: 'Success', description: 'New blood unit has been added.' });
      }
      onSave();
      setOpen(false);
      form.reset(unit ? undefined : { units: 1, collectionDate: new Date() });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save blood unit.' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {unit ? (
          <Button variant="ghost" size="icon">
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Blood Unit
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>{unit ? 'Edit' : 'Add New'} Blood Unit</DialogTitle>
              <DialogDescription>
                {unit ? 'Update the details for this blood unit.' : 'Enter the details for the new blood unit.'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <FormField control={form.control} name="bloodType" render={({ field }) => (<FormItem><FormLabel>Blood Type</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl><SelectContent>{bloodTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="units" render={({ field }) => (<FormItem><FormLabel>Units</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="collectionDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Collection Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className="font-normal justify-start"><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, 'PPP') : 'Pick a date'}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date > new Date()} /></PopoverContent></Popover><FormMessage /></FormItem>)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                Save Unit
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function AddTransferDialog({ facility, onSave }: { facility: User, onSave: () => void }) {
    const { toast } = useToast();
    const [open, setOpen] = useState(false);
    const form = useForm<TransferFormValues>({
        resolver: zodResolver(transferSchema),
        defaultValues: { units: 1 },
    });

    const onSubmit: SubmitHandler<TransferFormValues> = async (data) => {
        try {
            await addTransfer({
                ...data,
                source: facility.email,
                date: new Date().toISOString(),
            });
            toast({ title: 'Success', description: 'Transfer has been recorded.' });
            onSave();
            setOpen(false);
            form.reset({ units: 1 });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to record transfer.' });
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Transfer Record
                </Button>
            </DialogTrigger>
            <DialogContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                        <DialogHeader>
                            <DialogTitle>Record a New Transfer</DialogTitle>
                            <DialogDescription>Log a blood unit transfer to another facility.</DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-4">
                            <FormField control={form.control} name="destination" render={({ field }) => (<FormItem><FormLabel>Destination</FormLabel><FormControl><Input placeholder="e.g., County Medical Center" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="bloodType" render={({ field }) => (<FormItem><FormLabel>Blood Type</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl><SelectContent>{bloodTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="units" render={({ field }) => (<FormItem><FormLabel>Units</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                                Save Record
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

function AddReceivedUnitDialog({ facility, onSave }: { facility: User; onSave: () => void }) {
    const { toast } = useToast();
    const [open, setOpen] = useState(false);
    const form = useForm<ReceivedFormValues>({
        resolver: zodResolver(receivedSchema),
        defaultValues: { units: 1 },
    });

    const onSubmit: SubmitHandler<ReceivedFormValues> = async (data) => {
        try {
            await addTransfer({
                ...data,
                destination: facility.email,
                date: new Date().toISOString(),
            });
            toast({ title: 'Success', description: 'Received unit has been recorded.' });
            onSave();
            setOpen(false);
            form.reset({ units: 1 });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to record received unit.' });
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Received Record
                </Button>
            </DialogTrigger>
            <DialogContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                        <DialogHeader>
                            <DialogTitle>Record a Received Unit</DialogTitle>
                            <DialogDescription>Log a blood unit received from another facility.</DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-4">
                            <FormField control={form.control} name="source" render={({ field }) => (<FormItem><FormLabel>Source</FormLabel><FormControl><Input placeholder="e.g., Regional Blood Bank" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="bloodType" render={({ field }) => (<FormItem><FormLabel>Blood Type</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl><SelectContent>{bloodTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="units" render={({ field }) => (<FormItem><FormLabel>Units</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                                Save Record
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

function CreateOfferDialog({ user, onSave }: { user: User, onSave: () => void }) {
    const { toast } = useToast();
    const [open, setOpen] = useState(false);
    const form = useForm<OfferFormValues>({
        resolver: zodResolver(offerSchema),
        defaultValues: { units: 1 },
    });

    const onSubmit: SubmitHandler<OfferFormValues> = async (data) => {
        try {
            await createBloodOffer({
                ...data,
                message: data.message || '',
                creatorEmail: user.email,
                creatorName: user.name!,
            });
            toast({ title: 'Success', description: 'Your blood offer has been posted.' });
            onSave();
            setOpen(false);
            form.reset({ units: 1, message: '' });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message || 'Failed to post offer.' });
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <PlusCircle className="mr-2 h-4 w-4" /> Create Offer Post
                </Button>
            </DialogTrigger>
            <DialogContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                        <DialogHeader>
                            <DialogTitle>Create a Blood Offer</DialogTitle>
                            <DialogDescription>Offer your surplus blood units to other facilities in the network.</DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-4">
                            <FormField control={form.control} name="bloodType" render={({ field }) => (<FormItem><FormLabel>Blood Type</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl><SelectContent>{bloodTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="units" render={({ field }) => (<FormItem><FormLabel>Units</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="message" render={({ field }) => (<FormItem><FormLabel>Message (Optional)</FormLabel><FormControl><Textarea placeholder="Add any relevant details..." {...field} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                                Post Offer
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

function BloodBankPageContent() {
  const searchParams = useSearchParams();
  const view = searchParams.get('view') || 'inventory';
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [inventory, setInventory] = useState<BloodUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<Notification[]>([]);
  const [requestHistory, setRequestHistory] = useState<BloodRequest[]>([]);
  const [sentTransfers, setSentTransfers] = useState<Transfer[]>([]);
  const [receivedTransfers, setReceivedTransfers] = useState<Transfer[]>([]);
  const [bloodOffers, setBloodOffers] = useState<BloodOffer[]>([]);
  const [potentialFacilities, setPotentialFacilities] = useState<User[]>([]);
  const [responding, setResponding] = useState<string | null>(null);


  const fetchData = useCallback(async (email: string) => {
    try {
      setLoading(true);
      const [
        userData, 
        inventoryData,
        notifications,
        historyData,
        facilitiesData,
        sentData,
        receivedData,
        offersData,
      ] = await Promise.all([
        getUser(email),
        getBloodBankInventory(email),
        getNotificationsForUser(email),
        getBloodRequestsForUser(email),
        getPotentialDonors(),
        getSentTransfers(email),
        getReceivedTransfers(email),
        getBloodOffers(),
      ]);
      setUser(userData);
      setInventory(inventoryData);
      setRequests(notifications.filter(n => n.type === 'request' || n.type === 'claim'));
      setRequestHistory(historyData);
      setPotentialFacilities(facilitiesData.filter(f => (f.role === 'Hospital' || f.role === 'Blood Bank') && f.email !== email));
      setSentTransfers(sentData);
      setReceivedTransfers(receivedData);
      setBloodOffers(offersData);

    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch blood bank data.' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    const email = sessionStorage.getItem('currentUserEmail');
    if (email) {
      fetchData(email);
    } else {
      setLoading(false);
    }
  }, [fetchData]);

  const handleSave = () => {
    if (user?.email) {
      fetchData(user.email);
    }
  }

  const handleDeleteUnit = async (unitId: string) => {
      if (!user?.email) return;
      try {
          await deleteBloodUnitFromBank(unitId);
          toast({ title: 'Success', description: 'Blood unit has been deleted.'});
          fetchData(user.email);
      } catch (e) {
          toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete blood unit.' });
      }
  };

  const handleAcceptRequest = async (notification: Notification) => {
    if (!user || !notification.requestId) return;
    setResponding(notification.id);
    try {
        const result = await respondToRequest(notification.requestId, user, notification.requesterEmail);
        if (result.success) {
            toast({ title: "Request Accepted", description: "The requester has been notified." });
            if(user.email) fetchData(user.email);
        } else {
            throw new Error(result.message);
        }
    } catch(e: any) {
        toast({ variant: 'destructive', title: "Error", description: e.message || "Failed to accept request." });
    } finally {
        setResponding(null);
    }
  }
  
  const handleDeclineRequest = async (notification: Notification, reason: string) => {
    if (!user || !notification.requestId) return;
    setResponding(notification.id);
     try {
        const result = await declineRequest(notification.id, notification.requestId, user, notification.requesterEmail, reason);
        if (result.success) {
            toast({ title: "Request Declined", description: result.message });
            if(user.email) fetchData(user.email);
        } else {
            throw new Error(result.message);
        }
    } catch(e: any) {
        toast({ variant: 'destructive', title: "Error", description: e.message || "Failed to decline request." });
    } finally {
        setResponding(null);
    }
  }

  const handleClaimOffer = async (offerId: string) => {
      if (!user) return;
      try {
          const result = await claimBloodOffer(offerId, user);
          if (result.success) {
              toast({ title: 'Offer Claimed!', description: result.message });
              handleSave();
          } else {
              throw new Error(result.message);
          }
      } catch (e: any) {
          toast({ variant: 'destructive', title: 'Error', description: e.message || 'Failed to claim offer.' });
      }
  }

    const handleCancelOffer = async (offerId: string) => {
        if (!user) return;
        try {
            const result = await cancelBloodOffer(offerId, user.email);
            if (result.success) {
                toast({ title: 'Offer Cancelled', description: result.message });
                handleSave();
            } else {
                throw new Error(result.message);
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message || 'Failed to cancel offer.' });
        }
    }

  if (loading) {
    return <div className="flex items-center justify-center h-full"><LoaderCircle className="h-8 w-8 animate-spin" /><p className="ml-2">Loading data...</p></div>;
  }
  
  if (!user) {
    return <div className="text-center text-muted-foreground">User not found. Please log in again.</div>
  }

  return (
    <div className="space-y-6">
      {view === 'inventory' && (
        <Card className="shadow-md">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Blood Bank Inventory</CardTitle>
              <CardDescription>
                View and manage all available blood units.
              </CardDescription>
            </div>
             <AddEditUnitDialog bankEmail={user.email!} onSave={() => fetchData(user.email!)} />
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Blood Type</TableHead>
                  <TableHead>Units</TableHead>
                  <TableHead>Collection Date</TableHead>
                  <TableHead>Expiration Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventory.length > 0 ? inventory.map((unit) => {
                  const status = getUnitStatus(unit.expirationDate);
                  return (
                  <TableRow key={unit.id}>
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
                    <TableCell>{user.name}</TableCell>
                    <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDeleteUnit(unit.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                  </TableRow>
                )}) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">No inventory found.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {view === 'requests' && (
        <Card>
          <CardHeader>
            <CardTitle>Incoming Requests & Notifications</CardTitle>
            <CardDescription>
              Blood requests and claim notifications you have received.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.length > 0 ? (
                  requests.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell>
                        {formatDistanceToNow(new Date(req.date), {
                          addSuffix: true,
                        })}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{req.requesterName}</div>
                        <div className="text-xs text-muted-foreground">
                          {req.requesterEmail}
                        </div>
                      </TableCell>
                      <TableCell>
                         <div className="flex items-center gap-2">
                             <Badge variant="outline">{req.bloodType}</Badge>
                             <span>{req.units} units</span>
                         </div>
                         <p className="text-xs text-muted-foreground mt-1">{req.message}</p>
                      </TableCell>
                       <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            req.type === 'request' && 'border-blue-500 text-blue-500',
                            req.type === 'claim' && 'border-green-500 text-green-500',
                          )}
                        >
                          {req.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        {req.type === 'request' && req.requestId && (
                            <>
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => handleAcceptRequest(req)}
                                  disabled={!!responding}
                                >
                                  {responding === req.id ? (
                                    <LoaderCircle className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <>
                                      <Check className="mr-1 h-4 w-4" /> Accept
                                    </>
                                  )}
                                </Button>
                                <DeclineRequestDialog
                                  notification={req}
                                  onConfirm={(reason) =>
                                    handleDeclineRequest(req, reason)
                                  }
                                />
                            </>
                        )}
                         {req.type === 'claim' && (
                             <Button variant="ghost" size="sm" disabled>Claimed</Button>
                         )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-24">
                      No new notifications.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      
      {view === 'facility-requests' && (
        <Card>
          <CardHeader>
            <CardTitle>Request from a Facility</CardTitle>
            <CardDescription>
              Request blood from other hospitals or blood banks in the network.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Available Blood Types</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {potentialFacilities.map((facility) => (
                  <TableRow key={facility.email}>
                    <TableCell>{facility.name}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          facility.role === 'Blood Bank' ? 'secondary' : 'outline'
                        }
                      >
                        {facility.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {facility.city}, {facility.state}
                    </TableCell>
                    <TableCell className="flex flex-wrap gap-1">
                      {facility.availableBloodTypes &&
                      facility.availableBloodTypes.length > 0 ? (
                        facility.availableBloodTypes.map((type) => (
                          <Badge key={type} variant="outline">
                            {type}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          No inventory data
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DirectRequestDialog
                        recipient={facility}
                        requester={user!}
                        onSuccess={handleSave}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {view === 'polls' && (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex-row items-center justify-between">
                    <div>
                        <CardTitle>Available Blood Polls</CardTitle>
                        <CardDescription>Offers for surplus blood from other facilities.</CardDescription>
                    </div>
                     <CreateOfferDialog user={user} onSave={handleSave} />
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Offered By</TableHead><TableHead>Blood Type</TableHead><TableHead>Units</TableHead><TableHead>Message</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {bloodOffers.filter(o => o.creatorEmail !== user.email && o.status === 'Available').map(offer => (
                                <TableRow key={offer.id}>
                                    <TableCell>{formatDistanceToNow(parseISO(offer.date), { addSuffix: true })}</TableCell>
                                    <TableCell>{offer.creatorName}</TableCell>
                                    <TableCell><Badge variant="outline">{offer.bloodType}</Badge></TableCell>
                                    <TableCell>{offer.units}</TableCell>
                                    <TableCell className="text-xs text-muted-foreground">{offer.message}</TableCell>
                                    <TableCell className="text-right">
                                        <Button size="sm" onClick={() => handleClaimOffer(offer.id)}>Claim</Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                             {bloodOffers.filter(o => o.creatorEmail !== user.email && o.status === 'Available').length === 0 && (
                                <TableRow><TableCell colSpan={6} className="h-24 text-center">No available offers from other facilities.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
            <Card>
                <CardHeader><CardTitle>My Posted Polls</CardTitle><CardDescription>Offers you have created.</CardDescription></CardHeader>
                <CardContent>
                     <Table>
                        <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Blood Type</TableHead><TableHead>Units</TableHead><TableHead>Status</TableHead><TableHead>Claimed By</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                        <TableBody>
                           {bloodOffers.filter(o => o.creatorEmail === user.email).map(offer => (
                                <TableRow key={offer.id}>
                                    <TableCell>{formatDistanceToNow(parseISO(offer.date), { addSuffix: true })}</TableCell>
                                    <TableCell><Badge variant="outline">{offer.bloodType}</Badge></TableCell>
                                    <TableCell>{offer.units}</TableCell>
                                    <TableCell>
                                        <Badge variant={offer.status === 'Claimed' ? 'default' : 'secondary'} className={cn(offer.status === 'Claimed' && 'bg-green-600')}>{offer.status}</Badge>
                                    </TableCell>
                                    <TableCell>{offer.claimedByName || 'N/A'}</TableCell>
                                    <TableCell className="text-right">
                                        {offer.status === 'Available' && <Button variant="destructive" size="sm" onClick={() => handleCancelOffer(offer.id)}>Cancel</Button>}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {bloodOffers.filter(o => o.creatorEmail === user.email).length === 0 && (
                                <TableRow><TableCell colSpan={6} className="h-24 text-center">You have not posted any offers.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
      )}

      {view === 'analysis' && <AIForms />}

       {view === 'request-history' && (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Request History</CardTitle>
            <CardDescription>
              A log of past blood requests from your facility.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Blood Type</TableHead>
                  <TableHead>Units</TableHead>
                  <TableHead>Urgency</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requestHistory.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>{format(parseISO(request.date), 'PP')}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-primary border-primary/50">{request.bloodType}</Badge>
                    </TableCell>
                    <TableCell>{request.units}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("dark:!text-black", urgencyColors[request.urgency])}>{request.urgency}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          request.status === 'Fulfilled' ? 'default' : 'secondary'
                        }
                        className={cn(
                          request.status === 'Fulfilled' && 'bg-green-600 text-white',
                          request.status === 'In Progress' && 'bg-blue-500 text-white',
                          request.status === 'Pending' && 'bg-yellow-500 text-white',
                          request.status === 'Declined' && 'bg-red-500 text-white'
                        )}
                      >
                        {request.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {view === 'transfer-history' && (
        <div className="space-y-6">
          <Card className="shadow-md">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-muted-foreground" />
                  <CardTitle>Distribution History</CardTitle>
                </div>
                <CardDescription>
                  Log of blood units distributed to hospitals or other facilities.
                </CardDescription>
              </div>
              <AddTransferDialog facility={user} onSave={handleSave} />
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead>Blood Type</TableHead>
                    <TableHead className="text-right">Units</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sentTransfers.length > 0 ? sentTransfers.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{format(parseISO(item.date), 'PP')}</TableCell>
                      <TableCell>{item.destination}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-primary border-primary/50">{item.bloodType}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{item.units}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center">No sent transfers recorded.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card className="shadow-md">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-muted-foreground" />
                  <CardTitle>Received History</CardTitle>
                </div>
                <CardDescription>
                  Log of blood units received from other facilities.
                </CardDescription>
              </div>
              <AddReceivedUnitDialog facility={user} onSave={handleSave} />
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Blood Type</TableHead>
                    <TableHead className="text-right">Units</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receivedTransfers.length > 0 ? receivedTransfers.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{format(parseISO(item.date), 'PP')}</TableCell>
                      <TableCell>{item.source}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-primary border-primary/50">{item.bloodType}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{item.units}</TableCell>
                    </TableRow>
                  )): (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center">No received transfers recorded.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function BloodBankPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center h-full"><LoaderCircle className="h-8 w-8 animate-spin" /><p className="ml-2">Loading...</p></div>}>
            <BloodBankPageContent />
        </Suspense>
    )
}
