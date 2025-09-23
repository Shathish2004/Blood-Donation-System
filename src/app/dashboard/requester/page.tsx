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
import { format } from 'date-fns';
import { bloodTypes } from '@/lib/data';
import type { Urgency, BloodRequest } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Siren, XCircle, LoaderCircle, Send } from 'lucide-react';
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
import { Suspense } from 'react';
import { getUser, updateUserData, User, createBloodRequest, getBloodRequestsForUser, cancelBloodRequest, getPotentialDonors, createDirectBloodRequest, createEmergencyPoll } from '@/app/actions';

const requestSchema = z.object({
  bloodType: z.string().nonempty({ message: 'Blood type is required.' }),
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
    units: z.coerce.number().min(1, 'At least 1 unit is required.'),
    urgency: z.enum(['Low', 'Medium', 'High', 'Critical']),
});
type DirectRequestFormValues = z.infer<typeof directRequestSchema>;


const urgencyColors: Record<Urgency, string> = {
    Low: 'bg-blue-100 text-blue-800 border-blue-200',
    Medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    High: 'bg-orange-100 text-orange-800 border-orange-200',
    Critical: 'bg-red-100 text-red-800 border-red-200',
};


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
                <Button size="sm" disabled={recipient.role !== 'Donor' && (!recipient.availableBloodTypes || recipient.availableBloodTypes.length === 0)}>
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

function EmergencyPollDialog({user, onSent}: {user: User, onSent: () => void}) {
    const { toast } = useToast();
    const [open, setOpen] = React.useState(false);
    const [message, setMessage] = React.useState('');
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const handleSend = async () => {
        if (!message) {
            toast({ variant: 'destructive', title: 'Error', description: 'Emergency message cannot be empty.' });
            return;
        }
        setIsSubmitting(true);
        try {
            const result = await createEmergencyPoll(user, message);
            if (result.success) {
                toast({ title: 'Emergency Poll Sent!', description: 'An urgent broadcast has been sent to all users.' });
                onSent();
                setOpen(false);
                setMessage('');
            } else {
                throw new Error(result.message);
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message || 'Failed to send emergency poll.' });
        } finally {
            setIsSubmitting(false);
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
            <DialogHeader>
                <DialogTitle>Create Emergency Poll</DialogTitle>
                <DialogDescription>
                This will send an urgent notification to all users. Use only in critical situations.
                </DialogDescription>
            </DialogHeader>
            <div className="py-4">
                <Textarea 
                    placeholder="Describe the emergency... (e.g., Critical need for O- blood due to an accident at Main St.)"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)} 
                />
            </div>
            <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button variant="destructive" onClick={handleSend} disabled={isSubmitting || !message}>
                    {isSubmitting && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                    Send Urgent Broadcast
                </Button>
            </DialogFooter>
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


  const form = useForm<RequestFormValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      units: 1,
      urgency: 'Medium',
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

  const fetchRequests = React.useCallback(async (email: string) => {
    const requests = await getBloodRequestsForUser(email);
    setRequesterRequests(requests);
  }, []);

  const fetchDonors = React.useCallback(async () => {
    const donors = await getPotentialDonors();
    setPotentialDonors(donors);
  }, []);

  React.useEffect(() => {
    const fetchUserAndData = async () => {
      setLoading(true);
      const email = sessionStorage.getItem('currentUserEmail');
      if (email) {
        const userData = await getUser(email);
        if (userData) {
          setUser(userData);
          profileForm.reset(userData);
          await fetchRequests(email);
          await fetchDonors();
        }
      }
      setLoading(false);
    };

    fetchUserAndData();
  }, [profileForm, fetchRequests, fetchDonors]);

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
        await fetchRequests(user.email);
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
    } catch(e) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to update profile.'});
    }
  }

  const handleDirectRequestSuccess = () => {
      if (user?.email) {
          fetchRequests(user.email);
      }
  };


  const handleCancelRequest = async (requestId: string) => {
    try {
        await cancelBloodRequest(requestId);
        setRequesterRequests((prevRequests) => prevRequests.filter(req => req.id !== requestId));
        toast({
            title: 'Request Cancelled',
            description: `Your request has been successfully cancelled.`,
        });
    } catch (e) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to cancel request.'});
    }
  }

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
            <EmergencyPollDialog user={user} onSent={() => { /* maybe refresh some data if needed */ }} />
        </div>

        {view === 'request' && (
            <div className="grid gap-6 md:grid-cols-2">
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
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Units</TableHead>
                            <TableHead>Urgency</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {requesterRequests.map((request) => (
                            <TableRow key={request.id}>
                            <TableCell>{format(new Date(request.date), 'PP')}</TableCell>
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
                                     <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleCancelRequest(request.id)}>
                                        <XCircle className="h-4 w-4" />
                                        <span className="sr-only">Cancel</span>
                                    </Button>
                                )}
                            </TableCell>
                            </TableRow>
                        ))}
                        </TableBody>
                    </Table>
                    </CardContent>
                </Card>
            </div>
        )}

        {view === 'donors' && (
             <Card>
                <CardHeader>
                    <CardTitle>Find Donors &amp; Facilities</CardTitle>
                    <CardDescription>List of available donors, hospitals, and blood banks.</CardDescription>
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
                            {potentialDonors.length > 0 ? (
                                potentialDonors.map(donor => (
                                    <TableRow key={donor.email}>
                                        <TableCell>{donor.name}</TableCell>
                                        <TableCell>
                                          <Badge variant={donor.role === 'Donor' ? 'secondary' : 'outline'}>{donor.role}</Badge>
                                        </TableCell>
                                        <TableCell>{donor.city}, {donor.state}</TableCell>
                                        <TableCell className="flex flex-wrap gap-1">
                                            {donor.role === 'Donor' && donor.bloodType ? <Badge variant="outline" className="text-primary border-primary/50">{donor.bloodType}</Badge> 
                                            : donor.availableBloodTypes && donor.availableBloodTypes.length > 0 ? (
                                                donor.availableBloodTypes.map(type => <Badge key={type} variant="outline">{type}</Badge>)
                                            ) : (
                                                <span className="text-xs text-muted-foreground">N/A</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <DirectRequestDialog recipient={donor} requester={user} onSuccess={handleDirectRequestSuccess} />
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24">No available donors or facilities found.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                     </Table>
                </CardContent>
            </Card>
        )}

        {view === 'profile' && (
            <Card>
                <Form {...profileForm}>
                    <form onSubmit={profileForm.handleSubmit(onProfileSubmit)}>
                        <CardHeader>
                            <CardTitle>My Profile</CardTitle>
                            <CardDescription>Update your personal information.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <FormField control={profileForm.control} name="name" render={({field}) => (
                                <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage/></FormItem>
                            )} />
                            <FormField control={profileForm.control} name="email" render={({field}) => (
                                <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input {...field} type="email" readOnly/></FormControl><FormMessage/></FormItem>
                            )} />
                            <FormField control={profileForm.control} name="mobileNumber" render={({field}) => (
                                <FormItem><FormLabel>Contact Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage/></FormItem>
                            )} />
                            <FormField control={profileForm.control} name="address" render={({field}) => (
                                <FormItem><FormLabel>Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage/></FormItem>
                            )}/>
                            <FormField control={profileForm.control} name="bloodType" render={({field}) => (
                                <FormItem><FormLabel>Blood Type</FormLabel><FormControl><Input {...field} readOnly /></FormControl><FormMessage/></FormItem>
                            )}/>
                             <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <FormField control={profileForm.control} name="city" render={({ field }) => (<FormItem><FormLabel>City</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={profileForm.control} name="state" render={({ field }) => (<FormItem><FormLabel>State</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={profileForm.control} name="country" render={({ field }) => (<FormItem><FormLabel>Country</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                            </div>
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
