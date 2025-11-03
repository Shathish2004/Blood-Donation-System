
'use client';

import * as React from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { bloodTypes, donationTypes } from '@/lib/data';
import type { Urgency, BloodRequest, DonationType } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Siren, XCircle, LoaderCircle, Send, Search, Mail, Phone, Check, HandHeart, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback } from 'react';
import { getUser, updateUserData, User, createBloodRequest, getBloodRequestsForUser, cancelBloodRequest, getPotentialDonors, createDirectBloodRequest, createEmergencyPoll, getNotificationsForUser, respondToRequest, declineRequest } from '@/app/actions';
import type { Notification } from '@/lib/types';
import { indianStatesAndDistricts, states, districts } from '@/lib/indian-states-cities';

const requestSchema = z.object({
  bloodType: z.string().nonempty({ message: 'Blood type is required.' }),
  donationType: z.custom<DonationType>((val) => donationTypes.includes(val as DonationType), {
    message: "Invalid donation type.",
  }),
  units: z.coerce
    .number()
    .min(1, { message: 'Must request at least 1 unit.' })
    .max(10, { message: 'Cannot request more than 10 units at once.' }),
  urgency: z.enum(['Low', 'Medium', 'High', 'Critical']),
});

type RequestFormValues = z.infer<typeof requestSchema>;

const profileSchema = z.object({
    name: z.string().min(2, "Name is too short."),
    email: z.string().email(),
    mobileNumber: z.string().min(10, "Invalid contact number."),
    address: z.string().min(5, 'Address is required'),
    bloodType: z.string(),
    city: z.string(),
    state: z.string(),
    country: z.string(),
});
type ProfileFormValues = z.infer<typeof profileSchema>;

const directRequestSchema = z.object({
    bloodType: z.string().nonempty({ message: 'Blood type is required.' }),
    donationType: z.custom<DonationType>(),
    units: z.coerce.number().min(1, 'At least 1 unit is required.'),
    urgency: z.enum(['Low', 'Medium', 'High', 'Critical']),
});
type DirectRequestFormValues = z.infer<typeof directRequestSchema>;

const emergencyPollSchema = z.object({
    message: z.string().min(10, "Please provide a detailed message for the emergency.")
});
type EmergencyPollFormValues = z.infer<typeof emergencyPollSchema>;


const urgencyColors: Record<Urgency, string> = {
    Low: 'bg-blue-100 text-blue-800 border-blue-200',
    Medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    High: 'bg-orange-100 text-orange-800 border-orange-200',
    Critical: 'bg-red-100 text-red-800 border-red-200',
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
            bloodType: (recipient.role === 'Donor' || recipient.role === 'Individual') ? recipient.bloodType : (recipient.availableBloodTypes && recipient.availableBloodTypes.length > 0 ? recipient.availableBloodTypes[0] : undefined),
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

function EmergencyPollDialog({onSent, user}: {onSent: () => void, user: User | null}) {
    const { toast } = useToast();
    const [open, setOpen] = React.useState(false);
    
    const form = useForm<EmergencyPollFormValues>({
        resolver: zodResolver(emergencyPollSchema),
        defaultValues: {
            message: '',
        }
    });

    const onSubmit: SubmitHandler<EmergencyPollFormValues> = async (data) => {
        if (!user) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not find user. Please log in again.' });
            return;
        }

        try {
            const result = await createEmergencyPoll(user, data.message);
            if (result.success) {
                toast({ title: 'Emergency Poll Sent!', description: 'An urgent broadcast has been sent to all users.' });
                onSent();
                setOpen(false);
                form.reset();
            } else {
                throw new Error(result.message);
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message || 'Failed to send emergency poll.' });
        }
    };
    
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
            <Button variant="destructive">
                <Siren className="mr-2 h-4 w-4" /> Create Emergency Poll
            </Button>
            </DialogTrigger>
            <DialogContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                        <DialogHeader>
                            <DialogTitle>Create Emergency Poll</DialogTitle>
                            <DialogDescription>
                            This will send an urgent notification to all users. Use only in critical situations.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-4">
                            <FormField control={form.control} name="message" render={({ field }) => (
                                <FormItem><FormLabel>Message</FormLabel><FormControl><Textarea placeholder="Describe the emergency... (e.g., Due to a multi-car accident at Main St.)" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                            <Button variant="destructive" type="submit" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                                Send Urgent Broadcast
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}


function RequesterPageContent() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const view = searchParams.get('view') || 'request';
  const [requesterRequests, setRequesterRequests] = React.useState<BloodRequest[]>([]);
  const [potentialDonors, setPotentialDonors] = React.useState<User[]>([]);
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [filters, setFilters] = React.useState({ city: '', state: '', bloodType: '', role: '', donationType: '' });
  const [appliedFilters, setAppliedFilters] = React.useState({ city: '', state: '', bloodType: '', role: '', donationType: '' });
  const [incomingRequests, setIncomingRequests] = React.useState<Notification[]>([]);
  const [myRequestResponses, setMyRequestResponses] = React.useState<Notification[]>([]);
  const [responding, setResponding] = React.useState<string | null>(null);
  const selectedState = filters.state as keyof typeof indianStatesAndDistricts | undefined;


  const form = useForm<RequestFormValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      units: 1,
      urgency: 'Medium',
      donationType: 'whole_blood',
      bloodType: '',
    },
  });

  const profileForm = useForm<ProfileFormValues>({
      resolver: zodResolver(profileSchema),
      defaultValues: {
        name: '',
        email: '',
        mobileNumber: '',
        address: '',
        bloodType: '',
        city: '',
        state: '',
        country: '',
      }
  });

  const handleSave = useCallback(async () => {
    setLoading(true);
    const email = sessionStorage.getItem('currentUserEmail');
    if (!email) {
      setLoading(false);
      return;
    }
    try {
        const [userData, requests, donors, notifications] = await Promise.all([
            getUser(email),
            getBloodRequestsForUser(email),
            getPotentialDonors(),
            getNotificationsForUser(email),
        ]);
        
        if (userData) {
            setUser(userData);
            profileForm.reset(userData);
        }
        setRequesterRequests(requests);
        setPotentialDonors(donors);
        // Direct requests TO me + emergency broadcasts
        setIncomingRequests(notifications.filter(n => n.type === 'request' || n.type === 'emergency'));
        // Responses for requests I made
        setMyRequestResponses(notifications.filter(n => ['response', 'decline'].includes(n.type)));

    } catch (error) {
        toast({ variant: 'destructive', title: 'Error loading data', description: 'Could not load all dashboard data.' });
        console.error(error);
    } finally {
        setLoading(false);
    }
  }, [profileForm, toast]);

  React.useEffect(() => {
    handleSave();
  }, [handleSave]);

  const onSubmit: SubmitHandler<RequestFormValues> = async (data) => {
    if (!user?.email) {
        toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to make a request.' });
        return;
    }
    try {
        await createBloodRequest({ ...data, requester: user.email });
        toast({
        title: 'Request Submitted!',
        description: `Your request for ${data.units} unit(s) of ${data.bloodType} blood has been broadcast.`,
        });
        form.reset();
        handleSave();
    } catch (e) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to submit request.'});
    }
  };

  const onProfileSubmit: SubmitHandler<ProfileFormValues> = async (data) => {
    if (!user?.email) {
        toast({ variant: 'destructive', title: 'Error', description: 'User not found.' });
        return;
    }
    try {
        await updateUserData(user.email, data);
        toast({
            title: 'Profile Updated!',
            description: 'Your details have been successfully saved.',
        });
        handleSave();
    } catch(e) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to update profile.'});
    }
  }

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

  const handleCancelRequest = async (requestId: string) => {
    try {
        await cancelBloodRequest(requestId);
        toast({
            title: 'Request Cancelled',
            description: `Your request has been successfully cancelled.`,
        });
        handleSave();
    } catch (e) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to cancel request.'});
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
        
        return cityMatch && stateMatch && roleMatch && bloodTypeMatch;
    });
  }, [potentialDonors, appliedFilters, user]);

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoaderCircle className="h-8 w-8 animate-spin" />
        <p className="ml-2">Loading profile...</p>
      </div>
    );
  }

  return (
    <>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <h1 className="text-2xl font-bold">Individual Dashboard</h1>
            <EmergencyPollDialog user={user} onSent={handleSave} />
        </div>

        {view === 'request' && (
            <div className="grid gap-6">
                <Card className="shadow-md">
                    <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                        <CardHeader>
                        <CardTitle>Request Blood</CardTitle>
                        <CardDescription>
                            Fill out the form below to request blood. Your request will be
                            sent to nearby hospitals and blood banks.
                        </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
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
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                    <SelectValue placeholder="Select a blood type" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {bloodTypes.map((type) => (
                                    <SelectItem key={type} value={type}>
                                        {type}
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
                            name="units"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Units Required</FormLabel>
                                <FormControl>
                                <Input type="number" placeholder="e.g., 2" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="urgency"
                            render={({ field }) => (
                            <FormItem className="space-y-3">
                                <FormLabel>Urgency Level</FormLabel>
                                <FormControl>
                                <RadioGroup
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                    className="flex flex-col space-y-1"
                                >
                                    {(['Low', 'Medium', 'High', 'Critical'] as Urgency[]).map(level => (
                                        <FormItem key={level} className="flex items-center space-x-3 space-y-0">
                                            <FormControl>
                                                <RadioGroupItem value={level} />
                                            </FormControl>
                                            <FormLabel className="font-normal">{level}</FormLabel>
                                        </FormItem>
                                    ))}
                                </RadioGroup>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        </CardContent>
                        <CardFooter>
                        <Button type="submit" disabled={form.formState.isSubmitting}>
                            {form.formState.isSubmitting ? 'Submitting...' : 'Submit Request'}
                        </Button>
                        </CardFooter>
                    </form>
                    </Form>
                </Card>
                <Card className="shadow-md">
                    <CardHeader>
                    <CardTitle>My Request History</CardTitle>
                    <CardDescription>A log of your past blood requests.</CardDescription>
                    </CardHeader>
                    <CardContent>
                    {/* Mobile View: Card List */}
                    <div className="md:hidden space-y-4">
                        {requesterRequests.map((request) => (
                            <Card key={request._id} className="p-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-bold">Request ID: {request._id.slice(-6)}</p>
                                        <p className="text-sm text-muted-foreground">{format(new Date(request.date), 'PP')}</p>
                                    </div>
                                    <Badge variant={request.status === 'Fulfilled' ? 'default' : 'secondary'} className={cn( request.status === 'Fulfilled' && 'bg-green-600', request.status === 'Pending' && 'bg-yellow-500', request.status === 'In Progress' && 'bg-blue-500' )}>
                                        {request.status}
                                    </Badge>
                                </div>
                                <div className="mt-4 space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Blood Type:</span>
                                        <Badge variant="outline" className="text-primary border-primary/50">{request.bloodType}</Badge>
                                    </div>
                                     <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Donation Type:</span>
                                        <span className="capitalize">{request.donationType.replace(/_/g, ' ')}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Units:</span>
                                        <span>{request.units}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Urgency:</span>
                                        <Badge variant="outline" className={cn("dark:!text-black", urgencyColors[request.urgency])}>{request.urgency}</Badge>
                                    </div>
                                </div>
                                {request.status === 'Pending' && (
                                    <div className="mt-4 text-right">
                                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleCancelRequest(request._id)}>
                                            <XCircle className="h-4 w-4 mr-1" />
                                            Cancel
                                        </Button>
                                    </div>
                                )}
                            </Card>
                        ))}
                    </div>
                    {/* Desktop View: Table */}
                    <div className="hidden md:block">
                        <Table>
                            <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Donation Type</TableHead>
                                <TableHead>Blood Type</TableHead>
                                <TableHead>Units</TableHead>
                                <TableHead>Urgency</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                            </TableHeader>
                            <TableBody>
                            {requesterRequests.map((request) => (
                                <TableRow key={request._id}>
                                <TableCell>{format(new Date(request.date), 'PP')}</TableCell>
                                 <TableCell>
                                     <span className="capitalize">{request.donationType.replace(/_/g, ' ')}</span>
                                 </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className="text-primary border-primary/50">{request.bloodType}</Badge>
                                </TableCell>
                                <TableCell>{request.units}</TableCell>
                                <TableCell>
                                    <Badge variant="outline" className={cn("dark:!text-black", urgencyColors[request.urgency])}>{request.urgency}</Badge>
                                </TableCell>
                                <TableCell>
                                    <Badge variant={request.status === 'Fulfilled' ? 'default' : 'secondary'}
                                        className={cn(
                                            request.status === 'Fulfilled' && 'bg-green-600',
                                            request.status === 'Pending' && 'bg-yellow-500',
                                            request.status === 'In Progress' && 'bg-blue-500'
                                        )}
                                    >
                                        {request.status}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    {request.status === 'Pending' && (
                                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleCancelRequest(request._id)}>
                                            <XCircle className="h-4 w-4" />
                                            <span className="sr-only">Cancel</span>
                                        </Button>
                                    )}
                                </TableCell>
                                </TableRow>
                            ))}
                            </TableBody>
                        </Table>
                    </div>
                    </CardContent>
                </Card>
            </div>
        )}

        {view === 'incoming-requests' && (
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
                        Direct requests sent to you from others in need.
                    </CardDescription>
                    </CardHeader>
                    <CardContent>
                    {/* Mobile view */}
                    <div className="space-y-4 md:hidden">
                        {incomingRequests.filter(n => n.type === 'request').length > 0 ? incomingRequests.filter(n => n.type === 'request').map(req => (
                        <Card key={req._id} className="p-4">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                <p className="font-semibold">{req.requesterName}</p>
                                <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(req.date), { addSuffix: true })}</p>
                                </div>
                                <Badge variant="outline" className={cn('dark:!text-black', urgencyColors[req.urgency])}>{req.urgency}</Badge>
                            </div>
                            <div className="space-y-2 text-sm mb-4">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Blood Type:</span>
                                <Badge variant="outline">{req.bloodType}</Badge>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Contact:</span>
                                <span>{req.requesterMobileNumber || req.requesterEmail}</span>
                            </div>
                            </div>
                            {req.requestId && (
                                <div className="flex justify-end gap-2">
                                    <Button variant="default" size="sm" onClick={() => handleAcceptRequest(req)} disabled={!!responding}>
                                        {responding === req._id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <><Check className="mr-1 h-4 w-4" /> Accept</>}
                                    </Button>
                                    <DeclineRequestDialog notification={req} onConfirm={(reason) => handleDeclineRequest(req, reason)} />
                                </div>
                            )}
                        </Card>
                        )) : (
                        <div className="text-center h-24 flex items-center justify-center">
                            <p className="text-muted-foreground">No new requests.</p>
                        </div>
                        )}
                    </div>

                    {/* Desktop view */}
                    <div className="hidden md:block">
                        <Table>
                        <TableHeader>
                            <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Requester</TableHead>
                            <TableHead>Blood Type</TableHead>
                            <TableHead>Urgency</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {incomingRequests.filter(n => n.type === 'request').length > 0 ? (
                            incomingRequests.filter(n => n.type === 'request').map((req) => (
                                <TableRow key={req._id}>
                                <TableCell>{formatDistanceToNow(new Date(req.date), { addSuffix: true })}</TableCell>
                                <TableCell>
                                    <div className="font-medium">{req.requesterName}</div>
                                    <div className="text-xs text-muted-foreground">{req.requesterEmail}</div>
                                </TableCell>
                                <TableCell><Badge variant="outline">{req.bloodType}</Badge></TableCell>
                                <TableCell><Badge variant="outline" className={cn('dark:!text-black', urgencyColors[req.urgency])}>{req.urgency}</Badge></TableCell>
                                <TableCell className="flex justify-end text-right space-x-2">
                                    {req.requestId && (
                                        <>
                                            <Button variant="default" size="sm" onClick={() => handleAcceptRequest(req)} disabled={!!responding}>
                                                {responding === req._id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <><Check className="mr-1 h-4 w-4" /> Accept</>}
                                            </Button>
                                            <DeclineRequestDialog notification={req} onConfirm={(reason) => handleDeclineRequest(req, reason)} />
                                        </>
                                    )}
                                </TableCell>
                                </TableRow>
                            ))
                            ) : (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center h-24">No new requests.</TableCell>
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
                    {/* Mobile view */}
                    <div className="space-y-4 md:hidden">
                        {myRequestResponses.length > 0 ? myRequestResponses.map(req => (
                        <Card key={req._id} className="p-4">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                <p className="font-semibold">{req.requesterName}</p>
                                <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(req.date), { addSuffix: true })}</p>
                                </div>
                                <Badge variant="outline" className={cn(
                                    req.type === 'response' && 'text-green-500 border-green-500',
                                    req.type === 'decline' && 'text-red-500 border-red-500',
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

                    {/* Desktop view */}
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
                            {myRequestResponses.length > 0 ? (
                            myRequestResponses.map((req) => (
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
                                    )}>
                                    {req.type}
                                    </Badge>
                                </TableCell>
                                </TableRow>
                            ))
                            ) : (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center h-24">No new responses or notifications.</TableCell>
                            </TableRow>
                            )}
                        </TableBody>
                        </Table>
                    </div>
                    </CardContent>
                </Card>
            </div>
        )}

        {view === 'donors' && (
            <Card className="w-full">
                <CardHeader>
                    <CardTitle>Find Donors &amp; Facilities</CardTitle>
                    <CardDescription>List of available donors, hospitals, and blood banks.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="mb-6 p-4 border rounded-lg bg-card">
                         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                                    <SelectItem value="all">All Blood Types</SelectItem>
                                    {bloodTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Select value={filters.donationType} onValueChange={(value) => handleFilterChange('donationType', value === 'all' ? '' : value)}>
                                <SelectTrigger><SelectValue placeholder="Donation Type" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Donation Types</SelectItem>
                                    {donationTypes.map(type => <SelectItem key={type} value={type}>{type.replace(/_/g, ' ')}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Select value={filters.role} onValueChange={(value) => handleFilterChange('role', value === 'all' ? '' : value)}>
                                <SelectTrigger><SelectValue placeholder="Role" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Roles</SelectItem>
                                    <SelectItem value="Donor">Donor</SelectItem>
                                    <SelectItem value="Individual">Individual</SelectItem>
                                    <SelectItem value="Hospital">Hospital</SelectItem>
                                    <SelectItem value="Blood Bank">Blood Bank</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                            <Button onClick={handleApplyFilters}><Search className="mr-2 h-4 w-4" /> Apply Filters</Button>
                            <Button variant="ghost" onClick={handleClearFilters}>Clear Filters</Button>
                        </div>
                    </div>
                    {/* Mobile View: Card List */}
                    <div className="md:hidden space-y-4">
                        {filteredDonors.length > 0 ? (
                            filteredDonors.map(donor => (
                                <Card key={donor._id} className="p-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-bold">{donor.name}</p>
                                            <p className="text-sm text-muted-foreground">{donor.city}, {donor.state}</p>
                                            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                                                <p className="flex items-center gap-1"><Mail className="h-3 w-3" /> {donor.email}</p>
                                                <p className="flex items-center gap-1"><Phone className="h-3 w-3" /> {donor.mobileNumber}</p>
                                            </div>
                                        </div>
                                        <Badge variant={donor.role === 'Donor' ? 'secondary' : 'outline'}>{donor.role}</Badge>
                                    </div>
                                    <div className="flex items-center justify-between mt-4">
                                        <div className="flex flex-col text-sm space-y-1">
                                            {(donor.role === 'Donor' || donor.role === 'Individual') && donor.bloodType ? (
                                                <Badge variant="outline" className="text-primary border-primary/50">{donor.bloodType}</Badge>
                                            ) : (donor.role === 'Hospital' || donor.role === 'Blood Bank') && donor.inventorySummary ? (
                                              <>
                                                <p><span className="font-semibold">WB:</span> {donor.inventorySummary.whole_blood} units</p>
                                                <p><span className="font-semibold">Plasma:</span> {donor.inventorySummary.plasma} units</p>
                                                <p><span className="font-semibold">RBC:</span> {donor.inventorySummary.red_blood_cells} units</p>
                                                <div className="flex flex-wrap gap-1 pt-2">
                                                    {donor.availableBloodTypes?.map(type => <Badge key={type} variant="outline">{type}</Badge>)}
                                                </div>
                                              </>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">N/A</span>
                                            )}
                                        </div>
                                        <DirectRequestDialog recipient={donor} requester={user} onSuccess={handleSave} />
                                    </div>
                                </Card>
                            ))
                        ) : (
                             <div className="text-center h-24 flex items-center justify-center">
                                <p className="text-muted-foreground">No available donors or facilities found.</p>
                            </div>
                        )}
                    </div>
                    {/* Desktop View: Table */}
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
                                {filteredDonors.length > 0 ? (
                                    filteredDonors.map(donor => (
                                        <TableRow key={donor._id}>
                                            <TableCell>
                                                <div className="font-medium">{donor.name}</div>
                                                <div className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" />{donor.email}</div>
                                                <div className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{donor.mobileNumber}</div>
                                            </TableCell>
                                            <TableCell>
                                            <Badge variant={donor.role === 'Donor' ? 'secondary' : 'outline'}>{donor.role}</Badge>
                                            </TableCell>
                                            <TableCell>{donor.city}, {donor.state}</TableCell>
                                            <TableCell className="text-xs">
                                                {(donor.role === 'Donor' || donor.role === 'Individual') && donor.bloodType ? <Badge variant="outline" className="text-primary border-primary/50">{donor.bloodType}</Badge> 
                                                : (donor.role === 'Hospital' || donor.role === 'Blood Bank') && donor.inventorySummary ? (
                                                    <div className="flex flex-col">
                                                        <div className="flex flex-wrap gap-1 pb-1">
                                                            {donor.availableBloodTypes?.map(type => <Badge key={type} variant="outline" className="text-xs">{type}</Badge>)}
                                                        </div>
                                                        <span>Whole Blood: {donor.inventorySummary.whole_blood} units</span>
                                                        <span>Plasma: {donor.inventorySummary.plasma} units</span>
                                                        <span>Red Blood Cells: {donor.inventorySummary.red_blood_cells} units</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground">N/A</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <DirectRequestDialog recipient={donor} requester={user} onSuccess={handleSave} />
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">No available donors or facilities found.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        )}

        {view === 'profile' && (
            <Card className="w-full">
                <Form {...profileForm}>
                    <form onSubmit={profileForm.handleSubmit(onProfileSubmit)}>
                        <CardHeader>
                            <CardTitle>My Profile</CardTitle>
                            <CardDescription>Update your personal information.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                            <FormField control={profileForm.control} name="name" render={({field}) => (
                                <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage/></FormItem>
                            )} />
                            <FormField control={profileForm.control} name="email" render={({field}) => (
                                <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input {...field} type="email" readOnly/></FormControl><FormMessage/></FormItem>
                            )} />
                            <FormField control={profileForm.control} name="mobileNumber" render={({field}) => (
                                <FormItem><FormLabel>Contact Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage/></FormItem>
                            )} />
                             <FormField control={profileForm.control} name="bloodType" render={({field}) => (
                                <FormItem><FormLabel>Blood Type</FormLabel><FormControl><Input {...field} readOnly /></FormControl><FormMessage/></FormItem>
                            )}/>
                            <FormField control={profileForm.control} name="address" render={({field}) => (
                                <FormItem className="md:col-span-2"><FormLabel>Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage/></FormItem>
                            )}/>
                            <FormField control={profileForm.control} name="state" render={({ field }) => (<FormItem><FormLabel>State</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={profileForm.control} name="city" render={({ field }) => (<FormItem><FormLabel>District</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        </CardContent>
                        <CardFooter>
                            <Button type="submit" disabled={profileForm.formState.isSubmitting}>
                                {profileForm.formState.isSubmitting && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                                Save Changes
                            </Button>
                        </CardFooter>
                    </form>
                </Form>
            </Card>
        )}
    </>
  );
}


export default function RequesterPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <RequesterPageContent/>
        </Suspense>
    )
}
