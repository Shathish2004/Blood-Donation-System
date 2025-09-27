
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
  FormDescription,
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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { bloodTypes } from '@/lib/data';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, LoaderCircle, Sparkles, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { estimateExpiration, findBloodReportMatch, findInventoryMatches } from '@/app/actions';
import type { EstimateBloodExpirationDateOutput } from '@/ai/flows/blood-expiration-date-estimation';
import type { MatchBloodReportsOutput } from '@/ai/flows/blood-report-matching';
import { Input } from '@/components/ui/input';

const expirationSchema = z.object({
  bloodType: z.string().nonempty({ message: 'Blood type is required.' }),
  collectionDate: z.date({
    required_error: 'A collection date is required.',
  }),
  storageConditions: z
    .string()
    .min(10, { message: 'Please provide more detail on storage conditions.' }),
});
type ExpirationFormValues = z.infer<typeof expirationSchema>;

const reportMatchingSchema = z.object({
  reportA: z.any().refine(file => file?.length == 1, 'Blood Report A is required.'),
  reportB: z.any().refine(file => file?.length == 1, 'Blood Report B is required.'),
});
type ReportMatchingFormValues = z.infer<typeof reportMatchingSchema>;

const inventoryMatchingSchema = z.object({
  hospitalRequests: z.string().min(20, { message: 'Request data is too short.' }),
  bloodBankInventory: z.string().min(20, { message: 'Inventory data is too short.' }),
});
type InventoryMatchingFormValues = z.infer<typeof inventoryMatchingSchema>;


export function AITools({ onSave }: { onSave: () => void }) {
  const { toast } = useToast();
  const [expirationResult, setExpirationResult] = React.useState<EstimateBloodExpirationDateOutput | null>(null);
  const [reportMatchResult, setReportMatchResult] = React.useState<MatchBloodReportsOutput | null>(null);
  const [inventoryMatchingResult, setInventoryMatchingResult] = React.useState<string | null>(null);

  const expirationForm = useForm<ExpirationFormValues>({
    resolver: zodResolver(expirationSchema),
    defaultValues: { storageConditions: 'Standard refrigeration at 2-6°C.' },
  });

  const reportMatchingForm = useForm<ReportMatchingFormValues>({
    resolver: zodResolver(reportMatchingSchema),
  });

  const inventoryMatchingForm = useForm<InventoryMatchingFormValues>({
    resolver: zodResolver(inventoryMatchingSchema),
    defaultValues: {
        hospitalRequests: 'City General Hospital: 5 units of A+, 2 units of O-. Urgency: High.\nCounty Medical: 3 units of B+. Urgency: Medium.',
        bloodBankInventory: 'Blood Bank Alpha: A+ (50 units, expires in 30 days), O- (20 units, expires in 25 days), B+ (40 units, expires in 35 days).'
    }
  });

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const onExpirationSubmit: SubmitHandler<ExpirationFormValues> = async (data) => {
    try {
      const input = { ...data, collectionDate: format(data.collectionDate, 'yyyy-MM-dd') };
      const result = await estimateExpiration(input);
      setExpirationResult(result);
      toast({
        title: 'AI Estimation Complete!',
        description: 'Expiration date has been successfully estimated.',
      });
      onSave();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not get estimation. Please try again.',
      });
    }
  };

  const onReportMatchingSubmit: SubmitHandler<ReportMatchingFormValues> = async (data) => {
    try {
      const reportAContent = await readFileAsText(data.reportA[0]);
      const reportBContent = await readFileAsText(data.reportB[0]);

      const result = await findBloodReportMatch({
        reportA: reportAContent,
        reportB: reportBContent,
      });

      setReportMatchResult(result);
      toast({
        title: 'AI Match Complete!',
        description: 'Blood reports have been successfully compared.',
      });
      onSave();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not perform match. Please try again.',
      });
    }
  };

  const onInventoryMatchingSubmit: SubmitHandler<InventoryMatchingFormValues> = async (data) => {
    try {
      const result = await findInventoryMatches(data);
      setInventoryMatchingResult(result.matches);
       toast({
        title: 'AI Analysis Complete!',
        description: 'Matching analysis has been generated.',
      });
      onSave();
    } catch (error) {
       toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not perform analysis. Please try again.',
      });
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-1 xl:grid-cols-2">
      <Card className="shadow-md">
        <Form {...expirationForm}>
          <form onSubmit={expirationForm.handleSubmit(onExpirationSubmit)}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="text-accent" />
                AI Blood Expiration Estimation
              </CardTitle>
              <CardDescription>
                Use AI to estimate the expiration date based on storage data.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={expirationForm.control}
                name="bloodType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Blood Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a blood type" /></SelectTrigger></FormControl><SelectContent>{bloodTypes.map((type) => (<SelectItem key={type} value={type}>{type}</SelectItem>))}</SelectContent></Select><FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={expirationForm.control}
                name="collectionDate"
                render={({ field }) => (
                   <FormItem className="flex flex-col">
                    <FormLabel>Collection Date</FormLabel>
                    <Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? (format(field.value, "PPP")) : (<span>Pick a date</span>)}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date > new Date() || date < new Date("1900-01-01")} initialFocus /></PopoverContent></Popover><FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={expirationForm.control}
                name="storageConditions"
                render={({ field }) => (<FormItem><FormLabel>Storage Conditions</FormLabel><FormControl><Textarea placeholder="Describe storage conditions..." {...field} /></FormControl><FormMessage /></FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex-col items-start gap-4">
              <Button type="submit" disabled={expirationForm.formState.isSubmitting}>
                {expirationForm.formState.isSubmitting && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                Estimate Expiration
              </Button>
              {expirationResult && (
                <Card className="w-full bg-accent/30">
                  <CardHeader><CardTitle className="text-base">AI Estimation Result</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p><span className="font-semibold">Estimated Expiration:</span> {expirationResult.estimatedExpirationDate}</p>
                    <p><span className="font-semibold">Confidence Level:</span> {expirationResult.confidenceLevel}</p>
                  </CardContent>
                </Card>
              )}
            </CardFooter>
          </form>
        </Form>
      </Card>

      <Card className="shadow-md">
        <Form {...reportMatchingForm}>
          <form onSubmit={reportMatchingForm.handleSubmit(onReportMatchingSubmit)}>
             <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="text-accent" />
                AI Blood Report Matcher
              </CardTitle>
              <CardDescription>
                Compare two blood reports to get a compatibility score.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <FormField
                    control={reportMatchingForm.control}
                    name="reportA"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Report A (e.g., Patient)</FormLabel>
                            <FormControl>
                                <div className="relative">
                                    <Input 
                                      type="file" 
                                      className="pl-10"
                                      accept=".txt,.pdf,.doc,.docx"
                                      onChange={(e) => field.onChange(e.target.files)}
                                    />
                                    <Upload className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                </div>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={reportMatchingForm.control}
                    name="reportB"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Report B (e.g., Blood Unit)</FormLabel>
                             <FormControl>
                                <div className="relative">
                                    <Input 
                                      type="file" 
                                      className="pl-10"
                                      accept=".txt,.pdf,.doc,.docx"
                                      onChange={(e) => field.onChange(e.target.files)}
                                    />
                                    <Upload className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                </div>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </CardContent>
            <CardFooter className="flex-col items-start gap-4">
                 <Button type="submit" disabled={reportMatchingForm.formState.isSubmitting}>
                    {reportMatchingForm.formState.isSubmitting && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                    Get Match Score
                </Button>
                {reportMatchingForm.formState.isSubmitting && !reportMatchResult && (
                    <div className="w-full text-center p-4">
                        <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-primary" />
                        <p className="text-muted-foreground mt-2">AI is analyzing the reports...</p>
                    </div>
                )}
                {reportMatchResult && (
                    <Card className="w-full bg-accent/30">
                        <CardHeader><CardTitle className="text-base">AI Match Result</CardTitle></CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          <p><span className="font-semibold">Match Score:</span> {reportMatchResult.matchingScore}/100</p>
                          <p className="font-semibold">Explanation:</p>
                          <pre className="whitespace-pre-wrap font-sans bg-transparent p-0">{reportMatchResult.explanation}</pre>
                        </CardContent>
                    </Card>
                )}
            </CardFooter>
          </form>
        </Form>
      </Card>
      
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
