
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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, differenceInDays, parseISO, formatDistanceToNow } from 'date-fns';
import { bloodTypes, donationTypes } from '@/lib/data';
import type { Urgency, BloodRequest, BloodUnit, Notification, Transfer, BloodOffer, DonationType, BloodType } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  PlusCircle,
  Pencil,
  Trash2,
  Siren,
  Calendar as CalendarIcon,
  LoaderCircle,
  AlertTriangle,
  Check,
  X,
  Send,
  Truck,
  Package,
  Megaphone,
  Users,
  Search,
  Mail,
  Phone,
  FlaskConical,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm, SubmitHandler } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { getUser, getBloodRequestsForUser, getHospitalInventory, addBloodUnit, updateBloodUnit, deleteBloodUnit, getNotificationsForUser, respondToRequest, declineRequest, User, getPotentialDonors, createDirectBloodRequest, addTransfer, updateTransfer, getSentTransfers, getReceivedTransfers, createBloodOffer, getBloodOffers, claimBloodOffer, cancelBloodOffer, createEmergencyPoll } from '@/app/actions';
import { Suspense, useCallback } from 'react';
import { Form, FormControl, FormField, FormMessage, FormLabel, FormItem } from '@/components/ui/form';
import { useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AIForms } from '@/app/dashboard/blood-bank/ai-forms';
import { indianStatesAndDistricts, states, districts } from '@/lib/indian-states-cities';

const unitSchema = z.object({
  bloodType: z.string().nonempty("Blood type is required."),
  donationType: z.custom<DonationType>(),
  units: z.coerce.number().min(1, "At least one unit is required."),
  collectionDate: z.date({ required_error: "Collection date is required." }),
});
type UnitFormValues = z.infer<typeof unitSchema>;

const directRequestSchema = z.object({
    bloodType: z.string().nonempty({ message: 'Blood type is required.' }),
    donationType: z.custom<DonationType>(),
    units: z.coerce.number().min(1, 'At least 1 unit is required.'),
    urgency: z.enum(['Low', 'Medium', 'High', 'Critical']),
});
type DirectRequestFormValues = z.infer<typeof directRequestSchema>;

const transferSchema = z.object({
    party: z.string().min(3, "The other party is required."),
    bloodType: z.string().nonempty("Blood type is required."),
    units: z.coerce.number().min(1, "At least one unit is required."),
    date: z.date({ required_error: "Date is required."}),
    donationType: z.custom<DonationType>(),
});
type TransferFormValues = z.infer<typeof transferSchema>;


const offerSchema = z.object({
    bloodType: z.string().nonempty("Blood type is required."),
    donationType: z.custom<DonationType>(),
    units: z.coerce.number().min(1, "At least one unit is required."),
    message: z.string().optional(),
});
type OfferFormValues = z.infer<typeof offerSchema>;

const emergencyBroadcastSchema = z.object({
    bloodType: z.string().nonempty("Blood type is required."),
    units: z.coerce.number().min(1, "At least one unit is required."),
    urgency: z.enum(['High', 'Critical']),
    message: z.string().min(10, "Please provide more details about the emergency.")
});
type EmergencyBroadcastFormValues = z.infer<typeof emergencyBroadcastSchema>;


const urgencyColors: Record<Urgency, string> = {
  Low: 'bg-blue-100 text-blue-800 border-blue-200',
  Medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  High: 'bg-orange-100 text-orange-800 border-orange-200',
  Critical: 'bg-red-100 text-red-800 border-red-200',
};

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

function DeclineRequestDialog({ notification, onConfirm }: { notification: Notification, onConfirm: (reason: string) => void }) {
    const [reason, setReason] = React.useState('');
    const [open, setOpen] = React.useState(false);

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
    const [open, setOpen] = React.useState(false);
    const form = useForm<DirectRequestFormValues>({
        resolver: zodResolver(directRequestSchema),
        defaultValues: {
            units: 1,
            urgency: 'Medium',
            donationType: 'whole_blood',
            bloodType: (recipient.role === 'Donor' || recipient.role === 'Individual') ? recipient.bloodType : (recipient.availableBloodTypes && recipient.availableBloodTypes.length > 0 ? recipient.availableBloodTypes[0] : ''),
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
    
    const isRecipientRequestable = () => {
        if (recipient.role === 'Donor' || recipient.role === 'Individual') {
            return !!recipient.bloodType;
        }
        if (recipient.role === 'Hospital' || recipient.role === 'Blood Bank') {
            return recipient.availableBloodTypes && recipient.availableBloodTypes.length > 0;
        }
        return false;
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" disabled={!isRecipientRequestable()}>
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
                                name="donationType"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Donation Type</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a donation type" />
                                        </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                        {donationTypes.map((type) => (
                                            <SelectItem key={type} value={type}>
                                            {type.replace(/_/g, ' ')}
                                            </SelectItem>
                                        ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="bloodType"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Blood Type</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={recipient.role === 'Donor' || recipient.role === 'Individual'}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select blood type" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {(recipient.role === 'Donor' || recipient.role === 'Individual') && recipient.bloodType ? (
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

function AddEditUnitDialog({ unit, hospitalEmail, onSave, donationType }: { unit?: BloodUnit, hospitalEmail: string, onSave: () => void, donationType: DonationType }) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);

  const form = useForm<UnitFormValues>({
    resolver: zodResolver(unitSchema),
    defaultValues: unit ? {
      ...unit,
      collectionDate: parseISO(unit.collectionDate)
    } : {
      units: 1,
      collectionDate: new Date(),
      bloodType: '',
      donationType: donationType,
    }
  });

  React.useEffect(() => {
    form.setValue('donationType', donationType);
  }, [donationType, form])

  const onSubmit: SubmitHandler<UnitFormValues> = async (data) => {
    try {
      if (unit) {
        await updateBloodUnit(unit._id, { ...data, bloodType: data.bloodType as BloodType, collectionDate: data.collectionDate.toISOString() });
        toast({ title: 'Success', description: 'Blood unit has been updated.' });
      } else {
        await addBloodUnit({ ...data, location: hospitalEmail, bloodType: data.bloodType as BloodType, collectionDate: data.collectionDate.toISOString() }, hospitalEmail);
        toast({ title: 'Success', description: 'New blood unit has been added.' });
      }
      onSave();
      setOpen(false);
      form.reset({ units: 1, collectionDate: new Date(), bloodType: '', donationType: donationType });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save blood unit.' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {unit ? (
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Unit
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>{unit ? 'Edit' : 'Add New'} {donationType.replace(/_/g, ' ')} Unit</DialogTitle>
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

function AddEditTransferDialog({
    transfer,
    user,
    mode,
    onSave,
    donationType,
}: {
    transfer?: Transfer,
    user: User,
    mode: 'sent' | 'received',
    onSave: () => void,
    donationType: DonationType,
}) {
    const { toast } = useToast();
    const [open, setOpen] = React.useState(false);

    const form = useForm<TransferFormValues>({
        resolver: zodResolver(transferSchema),
        defaultValues: transfer ? {
            ...transfer,
            party: mode === 'sent' ? transfer.destination : transfer.source,
            date: parseISO(transfer.date),
        } : {
            party: '',
            bloodType: '',
            units: 1,
            date: new Date(),
            donationType: donationType,
        }
    });

    React.useEffect(() => {
        form.reset(transfer ? {
            ...transfer,
            party: mode === 'sent' ? transfer.destination : transfer.source,
            date: parseISO(transfer.date),
        } : {
            party: '',
            bloodType: '',
            units: 1,
            date: new Date(),
            donationType: donationType,
        });
         form.setValue('donationType', donationType);
    }, [transfer, mode, form, donationType]);

    const onSubmit: SubmitHandler<TransferFormValues> = async (data) => {
        try {
            const transferData = {
                source: mode === 'sent' ? user.email : data.party,
                destination: mode === 'sent' ? data.party : user.email,
                bloodType: data.bloodType as BloodType,
                units: data.units,
                date: data.date.toISOString(),
                donationType: data.donationType,
            };

            if (transfer) {
                await updateTransfer(transfer._id, transferData);
                toast({ title: 'Success', description: 'Transfer record has been updated.' });
            } else {
                await addTransfer(transferData);
                toast({ title: 'Success', description: 'New transfer has been recorded.' });
            }

            onSave();
            setOpen(false);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message || 'Failed to save transfer record.' });
        }
    };

    const dialogTitle = transfer ? 'Edit' : 'Add';
    const dialogDescription = mode === 'sent'
        ? `${dialogTitle} a record of blood sent to another facility.`
        : `${dialogTitle} a record of blood received from another facility.`;
    const partyLabel = mode === 'sent' ? 'Destination' : 'Source';
    const partyPlaceholder = mode === 'sent' ? 'e.g., County Medical Center' : 'e.g., Regional Blood Bank';
    const typeLabel = donationType.replace(/_/g, ' ');

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {transfer ? (
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Pencil className="h-4 w-4" />
                    </Button>
                ) : (
                    <Button>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        {mode === 'sent' ? 'Add Transfer' : 'Add Received'}
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                        <DialogHeader>
                            <DialogTitle>{dialogTitle} {mode === 'sent' ? 'Transfer' : 'Received'} Record - <span className="capitalize">{typeLabel}</span></DialogTitle>
                            <DialogDescription>{dialogDescription}</DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-4">
                             <FormField control={form.control} name="date" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className="font-normal justify-start"><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, 'PPP') : 'Pick a date'}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date > new Date()} /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="party" render={({ field }) => (<FormItem><FormLabel>{partyLabel}</FormLabel><FormControl><Input placeholder={partyPlaceholder} {...field} /></FormControl><FormMessage /></FormItem>)} />
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
    const [open, setOpen] = React.useState(false);
    const form = useForm<OfferFormValues>({
        resolver: zodResolver(offerSchema),
        defaultValues: { units: 1, bloodType: '', donationType: 'whole_blood', message: '' },
    });

    const onSubmit: SubmitHandler<OfferFormValues> = async (data) => {
        try {
            await createBloodOffer({
                ...data,
                message: data.message || '',
                creatorEmail: user.email,
                creatorName: user.name!,
                bloodType: data.bloodType as BloodType,
            });
            toast({ title: 'Success', description: 'Your blood offer has been posted.' });
            onSave();
            setOpen(false);
            form.reset({ units: 1, bloodType: '', donationType: 'whole_blood', message: '' });
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
                            <FormField
                                control={form.control}
                                name="donationType"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Donation Type</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a donation type" />
                                        </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                        {donationTypes.map((type) => (
                                            <SelectItem key={type} value={type}>
                                            {type.replace(/_/g, ' ')}
                                            </SelectItem>
                                        ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
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

function EmergencyBroadcastDialog({ currentUser, onSent }: { currentUser: User, onSent: () => void }) {
    const { toast } = useToast();
    const [open, setOpen] = React.useState(false);
    
    const form = useForm<EmergencyBroadcastFormValues>({
        resolver: zodResolver(emergencyBroadcastSchema),
        defaultValues: {
            units: 1,
            urgency: 'Critical',
            bloodType: '',
            message: '',
        }
    });

    const onSubmit: SubmitHandler<EmergencyBroadcastFormValues> = async (data) => {
        try {
            const fullMessage = `Emergency Broadcast from ${currentUser.name}: Urgently need ${data.units} unit(s) of ${data.bloodType} blood. Urgency: ${data.urgency}. ${data.message}`;
            await createEmergencyPoll(currentUser, fullMessage);
            toast({ title: 'Emergency Broadcast Sent!', description: 'An urgent notification has been sent to all users.' });
            onSent();
            setOpen(false);
            form.reset({ units: 1, urgency: 'Critical', bloodType: '', message: '' });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message || 'Failed to send broadcast.' });
        }
    };
    
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="destructive">
                    <Siren className="mr-2 h-4 w-4" /> Emergency Broadcast
                </Button>
            </DialogTrigger>
            <DialogContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                        <DialogHeader>
                            <DialogTitle>Emergency Broadcast</DialogTitle>
                            <DialogDescription>
                                Send an urgent notification to all available donors and blood banks. Use only in critical situations.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-4">
                            <FormField control={form.control} name="bloodType" render={({ field }) => (
                                <FormItem><FormLabel>Blood Type</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl><SelectContent>{bloodTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="units" render={({ field }) => (
                                <FormItem><FormLabel>Units Required</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                             <FormField control={form.control} name="urgency" render={({ field }) => (
                                <FormItem><FormLabel>Urgency</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select urgency" /></SelectTrigger></FormControl><SelectContent>{(['High', 'Critical'] as Urgency[]).map(level => <SelectItem key={level} value={level}>{level}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="message" render={({ field }) => (
                                <FormItem><FormLabel>Reason for Emergency</FormLabel><FormControl><Textarea placeholder="e.g., Critical need for O- blood at City General due to a major surgery." {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                            <Button type="submit" variant="destructive" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting && <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/>}
                                Send Broadcast
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

function HospitalPageContent() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const view = searchParams.get('view') || 'inventory';

  const [user, setUser] = React.useState<User | null>(null);
  const [inventory, setInventory] = React.useState<BloodUnit[]>([]);
  const [incomingRequests, setIncomingRequests] = React.useState<Notification[]>([]);
  const [mySentRequestResponses, setMySentRequestResponses] = React.useState<Notification[]>([]);
  const [requestHistory, setRequestHistory] = React.useState<BloodRequest[]>([]);
  const [transferHistory, setTransferHistory] = React.useState<Transfer[]>([]);
  const [receivedHistory, setReceivedHistory] = React.useState<Transfer[]>([]);
  const [bloodOffers, setBloodOffers] = React.useState<BloodOffer[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [responding, setResponding] = React.useState<string | null>(null);
  const [potentialDonors, setPotentialDonors] = React.useState<User[]>([]);
  const [filters, setFilters] = React.useState({ city: '', state: '', bloodType: '', role: '', donationType: '' });
  const [appliedFilters, setAppliedFilters] = React.useState({ city: '', state: '', bloodType: '', role: '', donationType: '' });
  const selectedState = filters.state as keyof typeof indianStatesAndDistricts | undefined;


  const handleSave = React.useCallback(async () => {
    const email = sessionStorage.getItem('currentUserEmail');
    if (!email) {
        setLoading(false);
        return;
    };
    setLoading(true);
    try {
      const [inventoryData, notifications, historyData, userData, donorsData, transfersData, receivedData, offersData] = await Promise.all([
        getHospitalInventory(email),
        getNotificationsForUser(email),
        getBloodRequestsForUser(email),
        getUser(email),
        getPotentialDonors(),
        getSentTransfers(email),
        getReceivedTransfers(email),
        getBloodOffers(),
      ]);
      setInventory(inventoryData);
      setIncomingRequests(notifications.filter(n => n.type === 'request' || n.type === 'emergency'));
      setMySentRequestResponses(notifications.filter(n => ['response', 'decline', 'claim'].includes(n.type)));
      setRequestHistory(historyData);
      setUser(userData);
      setPotentialDonors(donorsData);
      setTransferHistory(transfersData);
      setReceivedHistory(receivedData);
      setBloodOffers(offersData);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch hospital data.' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    handleSave();
  }, [handleSave]);
  

  const handleDeleteUnit = async (unitId: string) => {
      if (!user?.email) return;
      try {
          await deleteBloodUnit(unitId);
          toast({ title: 'Success', description: 'Blood unit has been deleted.'});
          handleSave();
      } catch (e) {
          toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete blood unit.' });
      }
  };

  const handleAcceptRequest = async (notification: Notification) => {
    if (!user || !notification.requestId) return;
    setResponding(notification._id);
    try {
        const result = await respondToRequest(notification._id, notification.requestId, user, notification.requesterEmail);
        if (result.success) {
            toast({ title: "Request Accepted", description: "The requester has been notified." });
            handleSave();
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
    setResponding(notification._id);
     try {
        const result = await declineRequest(notification._id, notification.requestId, user, notification.requesterEmail, reason);
        if (result.success) {
            toast({ title: "Request Declined", description: result.message });
            handleSave();
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

    const handleFilterChange = (filterType: keyof typeof filters, value: string) => {
        setFilters(prev => ({ ...prev, [filterType]: value }));
    };

    const handleApplyFilters = () => {
      setAppliedFilters(filters);
    };

    const handleClearFilters = () => {
      const cleared = { city: '', state: '', bloodType: '', role: '', donationType: '' };
      setFilters(cleared);
      setAppliedFilters(cleared);
    };

    const filteredDonors = React.useMemo(() => {
      return potentialDonors.filter(donor => {
          if (donor.email === user?.email) return false;
          
          const normalize = (str: string | undefined) => (str || '').toLowerCase().replace(/\s+/g, '');
          
          const cityMatch = !appliedFilters.city || normalize(donor.city).includes(normalize(appliedFilters.city));
          const stateMatch = !appliedFilters.state || normalize(donor.state).includes(normalize(appliedFilters.state));
          const roleMatch = !appliedFilters.role || donor.role === appliedFilters.role;
          const bloodTypeMatch = !appliedFilters.bloodType || (donor.bloodType === appliedFilters.bloodType) || (donor.availableBloodTypes && donor.availableBloodTypes.includes(appliedFilters.bloodType));
          const donationTypeMatch = !appliedFilters.donationType || (
            (donor.inventorySummary?.whole_blood ?? 0) > 0 && appliedFilters.donationType === 'whole_blood' ||
            (donor.inventorySummary?.plasma ?? 0) > 0 && appliedFilters.donationType === 'plasma' ||
            (donor.inventorySummary?.red_blood_cells ?? 0) > 0 && appliedFilters.donationType === 'red_blood_cells'
          );

          return cityMatch && stateMatch && roleMatch && bloodTypeMatch && donationTypeMatch;
      });
  }, [potentialDonors, appliedFilters, user]);
  
  if (loading) {
    return <div className="flex items-center justify-center h-full"><LoaderCircle className="h-8 w-8 animate-spin" /><p className="ml-2">Loading data...</p></div>;
  }
  
  if (!user) {
    return <div className="text-center text-muted-foreground">User not found. Please log in again.</div>
  }

  const renderInventoryTable = (donationType: DonationType) => {
    const filteredInventory = inventory.filter(u => u.donationType === donationType);
    const typeLabel = donationType.replace(/_/g, ' ');

    return (
        <Card>
          <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <CardTitle className="capitalize">{typeLabel} Inventory</CardTitle>
                <CardDescription>Manage your {typeLabel.toLowerCase()} stock.</CardDescription>
              </div>
              <AddEditUnitDialog hospitalEmail={user.email!} onSave={handleSave} donationType={donationType} />
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
                              <Badge variant="outline" className="text-primary border-primary/50 text-lg">{unit.bloodType}</Badge>
                              {unit.donationType && <p className="text-sm text-muted-foreground mt-1 capitalize">{unit.donationType.replace(/_/g, ' ')}</p>}
                              <p className="text-sm text-muted-foreground mt-1">{unit.units} units</p>
                            </div>
                            <Badge variant="secondary" className={cn('text-white', status.color)}>
                              {status.icon} {status.label}
                            </Badge>
                        </div>
                        <div className="space-y-2 text-sm mb-4">
                            <div className="flex justify-between">
                              <span className="font-medium text-muted-foreground">Collected:</span>
                              <span>{format(parseISO(unit.collectionDate), 'PP')}</span>
                            </div>
                             <div className="flex justify-between">
                              <span className="font-medium text-muted-foreground">Expires:</span>
                              <span>{format(parseISO(unit.expirationDate), 'PP')}</span>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <AddEditUnitDialog unit={unit} hospitalEmail={user.email!} onSave={handleSave} donationType={donationType} />
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDeleteUnit(unit._id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </Card>
                    );
                  })
                ) : (
                  <div className="text-center py-10">No {typeLabel.toLowerCase()} inventory found.</div>
                )}
              </div>

              {/* Desktop View */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Blood Type</TableHead>
                      <TableHead>Donation Type</TableHead>
                      <TableHead>Units</TableHead>
                      <TableHead>Collection Date</TableHead>
                      <TableHead>Expiration Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInventory.length > 0 ? filteredInventory.map((unit) => {
                      const status = getUnitStatus(unit.expirationDate);
                      return (
                        <TableRow key={unit._id}>
                          <TableCell>
                            <Badge variant="outline" className="text-primary border-primary/50">{unit.bloodType}</Badge>
                          </TableCell>
                           <TableCell className="capitalize">{unit.donationType ? unit.donationType.replace(/_/g, ' ') : 'N/A'}</TableCell>
                          <TableCell>{unit.units}</TableCell>
                          <TableCell>{format(parseISO(unit.collectionDate), 'PP')}</TableCell>
                          <TableCell>{format(parseISO(unit.expirationDate), 'PP')}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={cn('text-white', status.color)}>
                              {status.icon} {status.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <AddEditUnitDialog unit={unit} hospitalEmail={user.email!} onSave={handleSave} donationType={donationType} />
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDeleteUnit(unit._id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    }) : (
                       <TableRow>
                          <TableCell colSpan={7} className="h-24 text-center">No {typeLabel.toLowerCase()} inventory found.</TableCell>
                       </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
        </Card>
    );
  }

  const renderTransferHistory = (mode: 'sent' | 'received', donationType: DonationType) => {
    const history = mode === 'sent' ? transferHistory : receivedHistory;
    const filteredHistory = history.filter(t => t.donationType === donationType);
    const typeLabel = donationType.replace(/_/g, ' ');

    return (
      <Card>
        <CardHeader className="flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              {mode === 'sent' ? <Truck className="h-5 w-5 text-muted-foreground" /> : <Package className="h-5 w-5 text-muted-foreground" />}
              <CardTitle>{mode === 'sent' ? 'Distribution' : 'Received'} History - <span className="capitalize">{typeLabel}</span></CardTitle>
            </div>
            <CardDescription>
              {mode === 'sent' ? `Log of ${typeLabel} distributed to other facilities.` : `Log of ${typeLabel} received from other facilities.`}
            </CardDescription>
          </div>
          <AddEditTransferDialog user={user} mode={mode} onSave={handleSave} donationType={donationType} />
        </CardHeader>
        <CardContent>
          <div className="md:hidden space-y-4">
            {filteredHistory.length > 0 ? filteredHistory.map((item) => (
              <Card key={item._id} className="p-4">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="font-bold">{mode === 'sent' ? item.destination : item.source}</p>
                    <p className="text-xs text-muted-foreground">{format(parseISO(item.date), 'PP')}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="text-primary border-primary/50">{item.bloodType}</Badge>
                    <p className="text-sm">{item.units} units</p>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <AddEditTransferDialog transfer={item} user={user} mode={mode} onSave={handleSave} donationType={donationType} />
                </div>
              </Card>
            )) : <div className="text-center py-10">No {mode === 'sent' ? 'sent' : 'received'} {typeLabel} transfers recorded.</div>}
          </div>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>{mode === 'sent' ? 'Destination' : 'Source'}</TableHead>
                  <TableHead>Blood Type</TableHead>
                  <TableHead>Units</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHistory.length > 0 ? filteredHistory.map((item) => (
                  <TableRow key={item._id}>
                    <TableCell>{format(parseISO(item.date), 'PP')}</TableCell>
                    <TableCell>{mode === 'sent' ? item.destination : item.source}</TableCell>
                    <TableCell><Badge variant="outline" className="text-primary border-primary/50">{item.bloodType}</Badge></TableCell>
                    <TableCell>{item.units}</TableCell>
                    <TableCell className="text-right">
                      <AddEditTransferDialog transfer={item} user={user} mode={mode} onSave={handleSave} donationType={donationType} />
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">No {mode === 'sent' ? 'sent' : 'received'} {typeLabel} transfers recorded.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    );
  };
  
  return (
    <div className="space-y-6">
       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <h1 className="text-2xl font-bold">Hospital Dashboard</h1>
            <EmergencyBroadcastDialog currentUser={user} onSent={handleSave} />
        </div>

      {view === 'inventory' && (
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
      )}

      {view === 'requests' && (
        <div className="space-y-6">
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Siren />
                Emergency Broadcasts
              </CardTitle>
              <CardDescription>
                Urgent, high-priority requests from across the network.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {incomingRequests.filter(req => req.type === 'emergency').length > 0 ? (
                <div className="space-y-4">
                  {incomingRequests.filter(req => req.type === 'emergency').map(req => (
                    <Card key={req._id} className="bg-destructive/10 p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold">{req.requesterName}</p>
                          <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(req.date), { addSuffix: true })}</p>
                        </div>
                        <Badge variant="destructive">{req.urgency}</Badge>
                      </div>
                      <p className="text-sm">{req.message}</p>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center h-24 flex items-center justify-center">
                  <p className="text-muted-foreground">No current emergency broadcasts.</p>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Incoming Requests for You</CardTitle>
              <CardDescription>
                Blood requests you have received from individuals and facilities.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Mobile View */}
              <div className="space-y-4 md:hidden">
                  {incomingRequests.filter(n => n.type === 'request').length > 0 ? incomingRequests.filter(n => n.type === 'request').map(req => (
                      <Card key={req._id} className="p-4">
                          <div className="flex justify-between items-start mb-2">
                              <div>
                                  <p className="font-semibold">{req.requesterName}</p>
                                  <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(req.date), { addSuffix: true })}</p>
                              </div>
                              <Badge variant="outline" className={cn('border-blue-500 text-blue-500' )}>
                                  {req.type}
                              </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-4">{req.message}</p>
                          <div className="flex justify-end gap-2">
                              {req.type === 'request' && req.requestId && (
                                  <>
                                      <Button variant="default" size="sm" onClick={() => handleAcceptRequest(req)} disabled={!!responding}>
                                          {responding === req._id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <><Check className="mr-1 h-4 w-4" /> Accept</>}
                                      </Button>
                                      <DeclineRequestDialog notification={req} onConfirm={(reason) => handleDeclineRequest(req, reason)} />
                                  </>
                              )}
                          </div>
                      </Card>
                  )) : <div className="text-center h-24 flex items-center justify-center"><p>No new notifications.</p></div>}
              </div>
              {/* Desktop View */}
              <div className="hidden md:block">
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
                    {incomingRequests.filter(n => n.type === 'request').length > 0 ? (
                      incomingRequests.filter(n => n.type === 'request').map((req) => (
                        <TableRow key={req._id}>
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
                              className={cn('border-blue-500 text-blue-500')}
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
                                      {responding === req._id ? (
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
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>My Sent Requests - Status</CardTitle>
              <CardDescription>
                  Status updates on blood requests you have sent.
              </CardDescription>
            </CardHeader>
            <CardContent>
                {/* Mobile View */}
                <div className="space-y-4 md:hidden">
                    {mySentRequestResponses.length > 0 ? mySentRequestResponses.map(req => (
                        <Card key={req._id} className="p-4">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                <p className="font-semibold">{req.requesterName}</p>
                                <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(req.date), { addSuffix: true })}</p>
                                </div>
                                <Badge variant="outline" className={cn(
                                    req.type === 'response' && 'text-green-500 border-green-500',
                                    req.type === 'decline' && 'text-red-500 border-red-500',
                                    req.type === 'claim' && 'text-blue-500 border-blue-500',
                                )}>{req.type}</Badge>
                            </div>
                            <p className='text-sm'>{req.message}</p>
                        </Card>
                    )) : (
                        <div className="text-center h-24 flex items-center justify-center">
                            <p className="text-muted-foreground">No new responses or notifications.</p>
                        </div>
                    )}
                </div>
                {/* Desktop View */}
                <div className="hidden md:block">
                <Table>
                    <TableHeader>
                        <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>From</TableHead>
                        <TableHead>Message</TableHead>
                        <TableHead>Type</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {mySentRequestResponses.length > 0 ? (
                        mySentRequestResponses.map((req) => (
                            <TableRow key={req._id}>
                            <TableCell>{formatDistanceToNow(new Date(req.date), { addSuffix: true })}</TableCell>
                            <TableCell>
                                <div className="font-medium">{req.requesterName}</div>
                                <div className="text-xs text-muted-foreground">{req.requesterEmail}</div>
                            </TableCell>
                            <TableCell><p className="text-sm">{req.message}</p></TableCell>
                            <TableCell>
                                <Badge variant="outline" className={cn(
                                    req.type === 'response' && 'text-green-500 border-green-500',
                                    req.type === 'decline' && 'text-red-500 border-red-500',
                                    req.type === 'claim' && 'text-blue-500 border-blue-500',
                                )}>
                                {req.type}
                                </Badge>
                            </TableCell>
                            </TableRow>
                        ))
                        ) : (
                        <TableRow>
                            <TableCell colSpan={4} className="h-24 text-center">No new responses or notifications.</TableCell>
                        </TableRow>
                        )}
                    </TableBody>
                </Table>
                </div>
            </CardContent>
          </Card>
        </div>
      )}

      {(view === 'facility-requests' || view === 'find-donors') && (
        <Card>
          <CardHeader>
            <CardTitle>{view === 'facility-requests' ? 'Request from a Facility' : 'Find Donors'}</CardTitle>
            <CardDescription>
                {view === 'facility-requests' ? 'Request blood from other facilities in the network.' : 'View and request blood from individual donors.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-6 p-4 border rounded-lg bg-card">
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Select value={filters.state} onValueChange={(value) => { handleFilterChange('state', value === 'all' ? '' : value); handleFilterChange('city', ''); }}>
                        <SelectTrigger><SelectValue placeholder="State" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All States</SelectItem>
                            {states.map(state => <SelectItem key={state} value={state}>{state}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select value={filters.city} onValueChange={(value) => handleFilterChange('city', value === 'all' ? '' : value)} disabled={!filters.state}>
                        <SelectTrigger><SelectValue placeholder={filters.state ? "Select a district" : "Select a state first"} /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Districts</SelectItem>
                            {selectedState && districts(selectedState).map(district => <SelectItem key={district} value={district}>{district}</SelectItem>)}
                        </SelectContent>
                    </Select>
                     <Select value={filters.bloodType} onValueChange={(value) => handleFilterChange('bloodType', value === 'all' ? '' : value)}>
                        <SelectTrigger><SelectValue placeholder="Blood Type" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            {bloodTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                        </SelectContent>
                    </Select>
                     <Select value={filters.donationType} onValueChange={(value) => handleFilterChange('donationType', value === 'all' ? '' : value)}>
                        <SelectTrigger><SelectValue placeholder="Donation Type" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            {donationTypes.map(type => <SelectItem key={type} value={type} className="capitalize">{type.replace(/_/g, ' ')}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    {view === 'find-donors' && (
                        <Select value={filters.role} onValueChange={(value) => handleFilterChange('role', value === 'all' ? '' : value)}>
                            <SelectTrigger><SelectValue placeholder="Role" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="Donor">Donor</SelectItem>
                                <SelectItem value="Individual">Individual</SelectItem>
                            </SelectContent>
                        </Select>
                    )}
                    {view === 'facility-requests' && (
                        <Select value={filters.role} onValueChange={(value) => handleFilterChange('role', value === 'all' ? '' : value)}>
                            <SelectTrigger><SelectValue placeholder="Role" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="Hospital">Hospital</SelectItem>
                                <SelectItem value="Blood Bank">Blood Bank</SelectItem>
                            </SelectContent>
                        </Select>
                    )}
                </div>
                 <div className="flex justify-end gap-2 mt-4">
                    <Button onClick={handleApplyFilters}><Search className="mr-2 h-4 w-4" /> Apply Filters</Button>
                    <Button variant="ghost" onClick={handleClearFilters}>Clear Filters</Button>
                </div>
            </div>
            
            {/* Mobile View */}
            <div className="space-y-4 md:hidden">
                {filteredDonors.filter(d => (view === 'find-donors' ? ['Donor', 'Individual'].includes(d.role) : ['Hospital', 'Blood Bank'].includes(d.role))).map((item) => (
                     <Card key={item._id} className="p-4">
                        <div className="flex justify-between items-start mb-2">
                             <div>
                                <p className="font-bold">{item.name}</p>
                                <p className="text-sm text-muted-foreground">{item.city}, {item.state}</p>
                                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                                    <p className="flex items-center gap-1"><Mail className="h-3 w-3" /> {item.email}</p>
                                    <p className="flex items-center gap-1"><Phone className="h-3 w-3" /> {item.mobileNumber}</p>
                                  </div>
                             </div>
                             <Badge variant={item.role === 'Blood Bank' ? 'secondary' : 'outline'}>{item.role}</Badge>
                        </div>
                        <div className="flex items-center justify-between mt-4">
                          <div className="text-sm space-y-1 my-4">
                              {(item.role === 'Donor' || item.role === 'Individual') && item.bloodType ? (
                                  <Badge variant="outline" className="text-primary border-primary/50">{item.bloodType}</Badge>
                              ) : (item.role === 'Hospital' || item.role === 'Blood Bank') && item.inventorySummary ? (
                                  <>
                                  <p><span className="font-semibold">WB:</span> {item.inventorySummary.whole_blood} units</p>
                                  <p><span className="font-semibold">Plasma:</span> {item.inventorySummary.plasma} units</p>
                                  <p><span className="font-semibold">RBC:</span> {item.inventorySummary.red_blood_cells} units</p>
                                  <div className="flex flex-wrap gap-1 pt-2">
                                      {item.availableBloodTypes?.map(type => <Badge key={type} variant="outline">{type}</Badge>)}
                                  </div>
                                  </>
                              ) : (
                                  <span className="text-xs text-muted-foreground">N/A</span>
                              )}
                          </div>
                          <div className="flex justify-end">
                              <DirectRequestDialog recipient={item} requester={user!} onSuccess={handleSave} />
                          </div>
                        </div>
                     </Card>
                ))}
                 {filteredDonors.filter(d => (view === 'find-donors' ? ['Donor', 'Individual'].includes(d.role) : ['Hospital', 'Blood Bank'].includes(d.role))).length === 0 && (
                    <div className="text-center h-24 flex items-center justify-center"><p>No results found.</p></div>
                 )}
            </div>
            {/* Desktop View */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name & Contact</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Inventory / Blood Type</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDonors.filter(d => d.email !== user.email && (view === 'find-donors' ? ['Donor', 'Individual'].includes(d.role) : ['Hospital', 'Blood Bank'].includes(d.role))).map((item) => (
                    <TableRow key={item._id}>
                      <TableCell>
                        <div className="font-medium">{item.name}</div>
                          <>
                            <div className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" />{item.email}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{item.mobileNumber}</div>
                          </>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.role === 'Blood Bank' ? 'secondary' : 'outline'
                          }
                        >
                          {item.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {item.city}, {item.state}
                      </TableCell>
                      <TableCell className="text-xs">
                         {(item.role === 'Donor' || item.role === 'Individual') && item.bloodType ? <Badge variant="outline" className="text-primary border-primary/50">{item.bloodType}</Badge> 
                         : (item.role === 'Hospital' || item.role === 'Blood Bank') && item.inventorySummary ? (
                             <div className="flex flex-col">
                                 <div className="flex flex-wrap gap-1 pb-1">
                                     {item.availableBloodTypes?.map(type => <Badge key={type} variant="outline" className="text-xs">{type}</Badge>)}
                                 </div>
                                 <span>Whole Blood: {item.inventorySummary.whole_blood} units</span>
                                 <span>Plasma: {item.inventorySummary.plasma} units</span>
                                 <span>Red Blood Cells: {item.inventorySummary.red_blood_cells} units</span>
                             </div>
                         ) : (
                             <span className="text-muted-foreground">N/A</span>
                         )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DirectRequestDialog
                          recipient={item}
                          requester={user!}
                          onSuccess={handleSave}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredDonors.filter(d => d.email !== user.email && (view === 'find-donors' ? ['Donor', 'Individual'].includes(d.role) : ['Hospital', 'Blood Bank'].includes(d.role))).length === 0 && (
                      <TableRow>
                          <TableCell colSpan={5} className="h-24 text-center">No results found.</TableCell>
                      </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {view === 'polls' && (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <CardTitle>Available Blood Polls</CardTitle>
                        <CardDescription>Offers for surplus blood from other facilities.</CardDescription>
                    </div>
                     <CreateOfferDialog user={user} onSave={handleSave} />
                </CardHeader>
                <CardContent>
                     {/* Mobile View */}
                    <div className="space-y-4 md:hidden">
                        {bloodOffers.filter(o => o.creatorEmail !== user.email && o.status === 'Available').map(offer => (
                            <Card key={offer._id} className="p-4">
                                <div className="flex justify-between items-start mb-2">
                                     <div>
                                        <p className="font-bold">{offer.creatorName}</p>
                                        <p className="text-xs text-muted-foreground">{formatDistanceToNow(parseISO(offer.date), { addSuffix: true })}</p>
                                     </div>
                                     <div className="text-right">
                                        <Badge variant="outline">{offer.bloodType}</Badge>
                                        <p className="text-sm mt-1">{offer.units} units</p>
                                     </div>
                                </div>
                                <p className="text-sm capitalize font-medium mb-2">{offer.donationType.replace(/_/g, ' ')}</p>
                                {offer.message && <p className="text-sm text-muted-foreground mb-4">{offer.message}</p>}
                                <div className="flex justify-end">
                                    <Button size="sm" onClick={() => handleClaimOffer(offer._id)}>Claim</Button>
                                </div>
                            </Card>
                        ))}
                        {bloodOffers.filter(o => o.creatorEmail !== user.email && o.status === 'Available').length === 0 && (
                           <div className="text-center h-24 flex items-center justify-center"><p>No available offers from other facilities.</p></div>
                        )}
                    </div>
                    {/* Desktop View */}
                    <div className="hidden md:block">
                      <Table>
                          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Offered By</TableHead><TableHead>Donation Type</TableHead><TableHead>Blood Type</TableHead><TableHead>Units</TableHead><TableHead>Message</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                          <TableBody>
                              {bloodOffers.filter(o => o.creatorEmail !== user.email && o.status === 'Available').map(offer => (
                                  <TableRow key={offer._id}>
                                      <TableCell>{formatDistanceToNow(parseISO(offer.date), { addSuffix: true })}</TableCell>
                                      <TableCell>{offer.creatorName}</TableCell>
                                      <TableCell className="capitalize">{offer.donationType.replace(/_/g, ' ')}</TableCell>
                                      <TableCell><Badge variant="outline">{offer.bloodType}</Badge></TableCell>
                                      <TableCell>{offer.units}</TableCell>
                                      <TableCell className="text-xs text-muted-foreground">{offer.message}</TableCell>
                                      <TableCell className="text-right">
                                          <Button size="sm" onClick={() => handleClaimOffer(offer._id)}>Claim</Button>
                                      </TableCell>
                                  </TableRow>
                              ))}
                               {bloodOffers.filter(o => o.creatorEmail !== user.email && o.status === 'Available').length === 0 && (
                                  <TableRow><TableCell colSpan={7} className="h-24 text-center">No available offers from other facilities.</TableCell></TableRow>
                              )}
                          </TableBody>
                      </Table>
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader><CardTitle>My Posted Polls</CardTitle><CardDescription>Offers you have created.</CardDescription></CardHeader>
                <CardContent>
                    {/* Mobile View */}
                    <div className="space-y-4 md:hidden">
                        {bloodOffers.filter(o => o.creatorEmail === user.email).map(offer => (
                            <Card key={offer._id} className="p-4">
                               <div className="flex justify-between items-start mb-4">
                                     <div>
                                        <Badge variant="outline">{offer.bloodType}</Badge>
                                        <p className="text-sm mt-1 capitalize">{offer.donationType.replace(/_/g, ' ')}</p>
                                        <p className="text-sm text-muted-foreground mt-1">{offer.units} units</p>
                                     </div>
                                     <Badge variant={offer.status === 'Claimed' ? 'default' : 'secondary'} className={cn(offer.status === 'Claimed' && 'bg-green-600')}>{offer.status}</Badge>
                               </div>
                               <div className="space-y-2 text-sm mb-4">
                                    <div className="flex justify-between">
                                        <span className="font-medium text-muted-foreground">Date:</span>
                                        <span>{formatDistanceToNow(parseISO(offer.date), { addSuffix: true })}</span>
                                    </div>
                                     <div className="flex justify-between">
                                        <span className="font-medium text-muted-foreground">Claimed By:</span>
                                        <span>{offer.claimedByName || 'N/A'}</span>
                                    </div>
                               </div>
                               <div className="flex justify-end">
                                 {offer.status === 'Available' && <Button variant="destructive" size="sm" onClick={() => handleCancelOffer(offer._id)}>Cancel</Button>}
                               </div>
                            </Card>
                        ))}
                         {bloodOffers.filter(o => o.creatorEmail === user.email).length === 0 && (
                            <div className="text-center h-24 flex items-center justify-center"><p>You have not posted any offers.</p></div>
                        )}
                    </div>
                    {/* Desktop View */}
                    <div className="hidden md:block">
                       <Table>
                          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Donation Type</TableHead><TableHead>Blood Type</TableHead><TableHead>Units</TableHead><TableHead>Status</TableHead><TableHead>Claimed By</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                          <TableBody>
                             {bloodOffers.filter(o => o.creatorEmail === user.email).map(offer => (
                                  <TableRow key={offer._id}>
                                      <TableCell>{formatDistanceToNow(parseISO(offer.date), { addSuffix: true })}</TableCell>
                                      <TableCell className="capitalize">{offer.donationType.replace(/_/g, ' ')}</TableCell>
                                      <TableCell><Badge variant="outline">{offer.bloodType}</Badge></TableCell>
                                      <TableCell>{offer.units}</TableCell>
                                      <TableCell>
                                          <Badge variant={offer.status === 'Claimed' ? 'default' : 'secondary'} className={cn(offer.status === 'Claimed' && 'bg-green-600')}>{offer.status}</Badge>
                                      </TableCell>
                                      <TableCell>{offer.claimedByName || 'N/A'}</TableCell>
                                      <TableCell className="text-right">
                                          {offer.status === 'Available' && <Button variant="destructive" size="sm" onClick={() => handleCancelOffer(offer._id)}>Cancel</Button>}
                                      </TableCell>
                                  </TableRow>
                              ))}
                              {bloodOffers.filter(o => o.creatorEmail === user.email).length === 0 && (
                                  <TableRow><TableCell colSpan={7} className="h-24 text-center">You have not posted any offers.</TableCell></TableRow>
                              )}
                          </TableBody>
                      </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
      )}
      
      {view === 'history' && (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Request History</CardTitle>
            <CardDescription>
              A log of past blood requests from your facility.
            </CardDescription>
          </CardHeader>
          <CardContent>
             {/* Mobile View */}
            <div className="space-y-4 md:hidden">
              {requestHistory.map((request) => (
                  <Card key={request._id} className="p-4">
                       <div className="flex justify-between items-start mb-4">
                           <div>
                                <p className="font-bold">{format(parseISO(request.date), 'PP')}</p>
                                <p className="text-sm text-muted-foreground">{request.units} units of {request.bloodType}</p>
                           </div>
                           <Badge variant={ request.status === 'Fulfilled' ? 'default' : 'secondary' } className={cn( request.status === 'Fulfilled' && 'bg-green-600 text-white', request.status === 'In Progress' && 'bg-blue-500 text-white', request.status === 'Pending' && 'bg-yellow-500 text-white', request.status === 'Declined' && 'bg-red-500 text-white' )}>
                                {request.status}
                            </Badge>
                       </div>
                       <div className="flex justify-end">
                          <Badge variant="outline" className={cn("dark:!text-black", urgencyColors[request.urgency])}>{request.urgency}</Badge>
                       </div>
                  </Card>
              ))}
              {requestHistory.length === 0 && <div className="text-center h-24 flex items-center justify-center"><p>No request history.</p></div>}
            </div>
            {/* Desktop View */}
            <div className="hidden md:block">
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
                    <TableRow key={request._id}>
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
                  {requestHistory.length === 0 && <TableRow><TableCell colSpan={5} className="h-24 text-center">No request history.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {view === 'transfer-history' && (
        <Tabs defaultValue="whole_blood" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="whole_blood">Whole Blood</TabsTrigger>
            <TabsTrigger value="plasma">Plasma</TabsTrigger>
            <TabsTrigger value="red_blood_cells">Red Blood Cells</TabsTrigger>
          </TabsList>
          <TabsContent value="whole_blood" className="mt-4">{renderTransferHistory('sent', 'whole_blood')}</TabsContent>
          <TabsContent value="plasma" className="mt-4">{renderTransferHistory('sent', 'plasma')}</TabsContent>
          <TabsContent value="red_blood_cells" className="mt-4">{renderTransferHistory('sent', 'red_blood_cells')}</TabsContent>
        </Tabs>
      )}

       {view === 'received-history' && (
        <Tabs defaultValue="whole_blood" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="whole_blood">Whole Blood</TabsTrigger>
            <TabsTrigger value="plasma">Plasma</TabsTrigger>
            <TabsTrigger value="red_blood_cells">Red Blood Cells</TabsTrigger>
          </TabsList>
          <TabsContent value="whole_blood" className="mt-4">{renderTransferHistory('received', 'whole_blood')}</TabsContent>
          <TabsContent value="plasma" className="mt-4">{renderTransferHistory('received', 'plasma')}</TabsContent>
          <TabsContent value="red_blood_cells" className="mt-4">{renderTransferHistory('received', 'red_blood_cells')}</TabsContent>
        </Tabs>
      )}

      {view === 'analysis' && <AIForms onSave={handleSave} />}
    </div>
  );
}

export default function HospitalPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full"><LoaderCircle className="h-8 w-8 animate-spin" /><p className="ml-2">Loading...</p></div>}>
      <HospitalPageContent />
    </Suspense>
  );
}
