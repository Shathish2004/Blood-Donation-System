'use client';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Calendar as CalendarIcon,
  Check,
  CircleHelp,
  LoaderCircle,
  PlusCircle,
  Trash2,
  X,
} from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ToastAction } from '@/components/ui/toast';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  getUser,
  updateUserData,
  User,
  getNotificationsForUser,
  respondToRequest,
  declineRequest,
  getDonationHistory,
  addDonationHistory,
  deleteDonationHistory,
} from '@/app/actions';
import type { Notification, Urgency, Donation } from '@/lib/types';
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
import { bloodTypes } from '@/lib/data';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';


const profileSchema = z.object({
  name: z.string().min(2, 'Name is too short.'),
  email: z.string().email(),
  mobileNumber: z.string().min(10, 'Invalid contact number.'),
  address: z.string().min(5, 'Address is required'),
  bloodType: z.string(),
  city: z.string(),
  state: z.string(),
  country: z.string(),
});
type ProfileFormValues = z.infer<typeof profileSchema>;

const donationSchema = z.object({
    date: z.date({ required_error: "A donation date is required." }),
    location: z.string().min(3, "Location is required."),
    units: z.coerce.number().min(1, "Must be at least 1 unit."),
    bloodType: z.string().nonempty("Blood type is required.")
});
type DonationFormValues = z.infer<typeof donationSchema>;


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

function AddDonationDialog({ user, onDonationAdded }: { user: User; onDonationAdded: () => void }) {
    const { toast } = useToast();
    const [open, setOpen] = React.useState(false);
    const form = useForm<DonationFormValues>({
        resolver: zodResolver(donationSchema),
        defaultValues: {
            units: 1,
            bloodType: user.bloodType,
            location: '',
        }
    });

    const onSubmit: SubmitHandler<DonationFormValues> = async (data) => {
        try {
            await addDonationHistory({ ...data, date: data.date.toISOString(), donorEmail: user.email!, recipient: 'N/A' }); // recipient might need to be dynamic
            toast({ title: 'Success', description: 'Donation history has been added.' });
            onDonationAdded();
            setOpen(false);
            form.reset();
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to add donation.' });
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Donation
                </Button>
            </DialogTrigger>
            <DialogContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                        <DialogHeader>
                            <DialogTitle>Add Donation History</DialogTitle>
                            <DialogDescription>Record a past donation to keep your history accurate.</DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-4">
                             <FormField control={form.control} name="date" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Donation Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? (format(field.value, "PPP")) : (<span>Pick a date</span>)}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date > new Date()} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                             <FormField control={form.control} name="location" render={({ field }) => (<FormItem><FormLabel>Location (Hospital/Center)</FormLabel><FormControl><Input placeholder="e.g., City General Hospital" {...field} /></FormControl><FormMessage /></FormItem>)} />
                             <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="units" render={({ field }) => (<FormItem><FormLabel>Units</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="bloodType" render={({ field }) => (<FormItem><FormLabel>Blood Type</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl><SelectContent>{bloodTypes.map(type=><SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                             </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin"/> : "Save Donation"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}

function DonorPageContent() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const view = searchParams.get('view') || 'availability';
  const [isAvailable, setIsAvailable] = React.useState(true);
  const [lastDonation, setLastDonation] = React.useState<Date | undefined>(
    new Date()
  );
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [requests, setRequests] = React.useState<Notification[]>([]);
  const [responding, setResponding] = React.useState<string | null>(null);
  const [donationHistory, setDonationHistory] = React.useState<Donation[]>([]);


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
    },
  });

 const fetchUserData = React.useCallback(async (email: string) => {
    setLoading(true);
    try {
        const [userData, userNotifications, history] = await Promise.all([
            getUser(email),
            getNotificationsForUser(email),
            getDonationHistory(email)
        ]);

        if (userData) {
            setUser(userData);
            profileForm.reset(userData);
        }
        
        const incomingRequests = userNotifications.filter(
            (notification) => notification.type === 'request'
        );
        setRequests(incomingRequests);
        setDonationHistory(history);

    } catch (error) {
        console.error("Failed to fetch user data:", error);
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Failed to load your data. Please try again later.',
        });
    } finally {
        setLoading(false);
    }
}, [profileForm, toast]);


  React.useEffect(() => {
    const email = sessionStorage.getItem('currentUserEmail');
    if (email) {
      fetchUserData(email);
    } else {
        setLoading(false);
    }
  }, [fetchUserData]);

  const handleSave = () => {
    toast({
      title: 'Success!',
      description: 'Your availability has been updated.',
      action: <ToastAction altText="Undo">Undo</ToastAction>,
    });
  };

  const onProfileSubmit: SubmitHandler<ProfileFormValues> = async (data) => {
    if (!user?.email) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'User not found.',
      });
      return;
    }
    try {
      await updateUserData(user.email, data);
      toast({
        title: 'Profile Updated!',
        description: 'Your details have been successfully saved.',
      });
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update profile.',
      });
    }
  };

  const handleAcceptRequest = async (notification: Notification) => {
    if (!user || !notification.requestId) return;
    setResponding(notification.id);
    try {
        const result = await respondToRequest(notification.requestId, user, notification.requesterEmail);
        if (result.success) {
            toast({ title: "Request Accepted", description: "The requester has been notified." });
            if(user.email) fetchUserData(user.email); // Refresh data
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
            if(user.email) fetchUserData(user.email); // Refresh data
        } else {
            throw new Error(result.message);
        }
    } catch(e: any) {
        toast({ variant: 'destructive', title: "Error", description: e.message || "Failed to decline request." });
    } finally {
        setResponding(null);
    }
  }

  const handleDeleteDonation = async (donationId: string) => {
    try {
      await deleteDonationHistory(donationId);
      toast({ title: 'Success', description: 'Donation record deleted.' });
      if (user?.email) fetchUserData(user.email); // Refresh data
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete record.' });
    }
  };


  const eligibilityDate = lastDonation
    ? new Date(lastDonation.getTime() + 56 * 24 * 60 * 60 * 1000)
    : new Date();
  const isEligible = new Date() > eligibilityDate;

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
      {view === 'availability' && (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Update Availability</CardTitle>
            <CardDescription>
              Manage your donation status and dates.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
              <Label
                htmlFor="availability-switch"
                className="flex flex-col space-y-1"
              >
                <span>Available to Donate</span>
                <span className="font-normal leading-snug text-muted-foreground">
                  Turn this on to appear in searches for available donors.
                </span>
              </Label>
              <Switch
                id="availability-switch"
                checked={isAvailable}
                onCheckedChange={setIsAvailable}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last-donation-date">Last Donation Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="last-donation-date"
                    variant={'outline'}
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !lastDonation && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {lastDonation ? (
                      format(lastDonation, 'PPP')
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={lastDonation}
                    onSelect={setLastDonation}
                    initialFocus
                    disabled={(date) => date > new Date()}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div
              className={`flex items-center p-4 rounded-lg ${
                isEligible
                  ? 'bg-green-100 dark:bg-green-900/50'
                  : 'bg-amber-100 dark:bg-amber-900/50'
              }`}
            >
              {isEligible ? (
                <Check className="h-5 w-5 mr-3 text-green-600 dark:text-green-400" />
              ) : (
                <CircleHelp className="h-5 w-5 mr-3 text-amber-600 dark:text-amber-400" />
              )}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <p
                        className={`font-semibold ${
                          isEligible
                            ? 'text-green-800 dark:text-green-300'
                            : 'text-amber-800 dark:text-amber-300'
                        }`}
                      >
                        {isEligible
                          ? 'You are eligible to donate!'
                          : 'Next Eligible Donation Date'}
                      </p>
                      <p
                        className={`text-sm ${
                          isEligible
                            ? 'text-green-700 dark:text-green-400'
                            : 'text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        {isEligible
                          ? 'Thank you for being ready to save a life.'
                          : format(eligibilityDate, 'PPP')}
                      </p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Whole blood donors can donate every 56 days.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleSave}>Save Changes</Button>
          </CardFooter>
        </Card>
      )}

      {view === 'requests' && (
        <Card>
          <CardHeader>
            <CardTitle>My Incoming Requests</CardTitle>
            <CardDescription>
              Blood requests you have received from individuals and facilities.
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                        <div className="text-xs text-muted-foreground">
                          {req.requesterMobileNumber}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{req.bloodType}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn('dark:!text-black', urgencyColors[req.urgency])}
                        >
                          {req.urgency}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
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
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-24">
                      No new requests.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {view === 'history' && (
        <Card className="shadow-md">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Donation History</CardTitle>
              <CardDescription>
                A record of your past donations. Thank you for your support!
              </CardDescription>
            </div>
            <AddDonationDialog
              user={user}
              onDonationAdded={() => fetchUserData(user.email!)}
            />
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Blood Type</TableHead>
                  <TableHead>Units</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {donationHistory.length > 0 ? (
                  donationHistory.map((donation) => (
                    <TableRow key={donation.id}>
                      <TableCell>
                        {format(new Date(donation.date), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>{donation.location}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="text-primary border-primary/50"
                        >
                          {donation.bloodType}
                        </Badge>
                      </TableCell>
                      <TableCell>{donation.units}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteDonation(donation.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-24">
                      No donation history recorded.
                    </TableCell>
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
                <CardDescription>
                  Update your personal information.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={profileForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={profileForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" readOnly />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={profileForm.control}
                  name="mobileNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Number</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={profileForm.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={profileForm.control}
                  name="bloodType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Blood Type</FormLabel>
                      <FormControl>
                        <Input {...field} readOnly />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FormField
                    control={profileForm.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={profileForm.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={profileForm.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  type="submit"
                  disabled={profileForm.formState.isSubmitting}
                >
                  {profileForm.formState.isSubmitting && (
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  )}
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

export default function DonorPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DonorPageContent />
    </Suspense>
  );
}
