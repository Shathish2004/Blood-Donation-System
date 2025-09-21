'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Droplet } from 'lucide-react';
import React from 'react';
import { bloodTypes } from '@/lib/data';
import { saveUser } from '@/app/actions';

const baseSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters.' }),
  mobileNumber: z.string().min(10, { message: 'Must be a valid mobile number.' }),
  city: z.string().min(2, { message: 'City is required.' }),
  state: z.string().min(2, { message: 'State is required.' }),
  country: z.string().min(2, { message: 'Country is required.' }),
});

const individualSchema = baseSchema.extend({
  role: z.literal('Individual'),
  name: z.string().min(2, { message: 'Full name must be at least 2 characters.' }),
  address: z.string().min(5, { message: 'Address is required.' }),
  bloodType: z.string().nonempty({ message: 'Blood type is required.' }),
  licenseNo: z.string().optional(),
  location: z.string().optional(),
});

const donorSchema = baseSchema.extend({
  role: z.literal('Donor'),
  name: z.string().min(2, { message: 'Full name must be at least 2 characters.' }),
  address: z.string().min(5, { message: 'Address is required.' }),
  bloodType: z.string().nonempty({ message: 'Blood type is required.' }),
  licenseNo: z.string().optional(),
  location: z.string().optional(),
});

const hospitalSchema = baseSchema.extend({
    role: z.literal('Hospital'),
    name: z.string().min(2, { message: 'Hospital name is required.' }),
    licenseNo: z.string().min(5, { message: 'A valid license number is required.' }),
    location: z.string().min(5, { message: 'Location is required.' }),
    address: z.string().optional(),
    bloodType: z.string().optional(),
});

const bloodBankSchema = baseSchema.extend({
    role: z.literal('Blood Bank'),
    name: z.string().min(2, { message: 'Blood Bank name is required.' }),
    licenseNo: z.string().min(5, { message: 'A valid license number is required.' }),
    location: z.string().min(5, { message: 'Location is required.' }),
    address: z.string().optional(),
    bloodType: z.string().optional(),
});

const registerSchema = z.discriminatedUnion("role", [
    individualSchema,
    donorSchema,
    hospitalSchema,
    bloodBankSchema,
]);

type RegisterFormValues = z.infer<typeof registerSchema>;

const roles = ['Donor', 'Individual', 'Hospital', 'Blood Bank'];

export default function RegisterPage() {
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: 'Donor', name: '', address: '', bloodType: '', email: '', password: '', mobileNumber: '', city: '', state: '', country: '', licenseNo: '', location: '' }
  });

  const selectedRole = form.watch('role');

  const onSubmit = async (data: RegisterFormValues) => {
    try {
        await saveUser(data);
        toast({
            title: 'Registration Successful!',
            description: 'Redirecting to login...',
        });
        
        router.push(`/login?email=${encodeURIComponent(data.email)}`);

    } catch (error) {
        console.error('Failed to save user', error);
        toast({
            variant: 'destructive',
            title: 'Registration Failed',
            description: 'Could not save your registration details. Please try again.',
        });
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
            <div className="flex justify-center items-center mb-4">
                <Droplet className="h-10 w-10 text-primary" />
            </div>
            <h1 className="text-3xl font-bold font-headline text-foreground">
                Create an Account
            </h1>
            <p className="text-muted-foreground mt-1">
                Join our community and start saving lives.
            </p>
        </div>
        <Card className="shadow-xl">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardHeader>
                <CardTitle>Register</CardTitle>
                <CardDescription>
                  Fill out the form below to create your account.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>I am a...</FormLabel>
                       <Select onValueChange={(value) => {
                          field.onChange(value);
                          form.reset({
                            email: form.getValues().email,
                            password: form.getValues().password,
                            role: value as any,
                            name: '',
                            address: '',
                            bloodType: '',
                            licenseNo: '',
                            location: '',
                            mobileNumber: '',
                            city: '',
                            state: '',
                            country: '',
                          });
                       }} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select your role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {roles.map((role) => (
                            <SelectItem key={role} value={role}>
                              {role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Common Fields */}
                 <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{selectedRole === 'Hospital' ? 'Hospital Name' : selectedRole === 'Blood Bank' ? 'Blood Bank Name' : 'Full Name'}</FormLabel>
                      <FormControl>
                        <Input placeholder={selectedRole === 'Hospital' ? 'e.g., City General Hospital' : selectedRole === 'Blood Bank' ? 'e.g., Regional Blood Bank' : 'e.g., John Doe'} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{selectedRole === 'Hospital' ? 'Hospital Email' : selectedRole === 'Blood Bank' ? 'Blood Bank Email' : 'Email'}</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="user@email.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="********" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="mobileNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mobile Number</FormLabel>
                      <FormControl>
                        <Input placeholder="123-456-7890" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Individual/Donor Fields */}
                {(selectedRole === 'Individual' || selectedRole === 'Donor') && (
                  <>
                    <FormField control={form.control} name="address" render={({ field }) => (<FormItem><FormLabel>Address</FormLabel><FormControl><Input placeholder="123 Main St" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="bloodType" render={({ field }) => (<FormItem><FormLabel>Blood Type</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select blood type" /></SelectTrigger></FormControl><SelectContent>{bloodTypes.map(type=><SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                  </>
                )}

                {/* Hospital/Blood Bank Fields */}
                {(selectedRole === 'Hospital' || selectedRole === 'Blood Bank') && (
                    <>
                        <FormField control={form.control} name="licenseNo" render={({ field }) => (<FormItem><FormLabel>{selectedRole === 'Hospital' ? 'Hospital License Number' : 'Blood Bank License Number'}</FormLabel><FormControl><Input placeholder="LIC123456" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="location" render={({ field }) => (<FormItem><FormLabel>Location</FormLabel><FormControl><Input placeholder="e.g. Downtown Core" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    </>
                )}
                
                {/* Common Location Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <FormField control={form.control} name="city" render={({ field }) => (<FormItem><FormLabel>City</FormLabel><FormControl><Input placeholder="e.g., New York" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="state" render={({ field }) => (<FormItem><FormLabel>State</FormLabel><FormControl><Input placeholder="e.g., NY" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="country" render={({ field }) => (<FormItem><FormLabel>Country</FormLabel><FormControl><Input placeholder="e.g., USA" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
              </CardContent>
              <CardFooter className="flex-col items-stretch gap-4">
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? 'Registering...' : 'Create Account'}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                    Already have an account?{' '}
                    <Link href="/login" className="font-semibold text-primary hover:underline">
                        Login
                    </Link>
                </p>
              </CardFooter>
            </form>
          </Form>
        </Card>
      </div>
    </div>
  );
}
