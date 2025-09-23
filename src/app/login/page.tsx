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
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Droplet, Eye, EyeOff } from 'lucide-react';
import React, { Suspense, useEffect, useState } from 'react';
import { getUser } from '@/app/actions';

const loginSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function LoginComponent() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const emailFromRegister = searchParams.get('email');
  useEffect(() => {
    if (emailFromRegister) {
        form.setValue('email', emailFromRegister);
    }
  }, [emailFromRegister, form]);


  const onSubmit = async (data: LoginFormValues) => {
    // Hardcoded admin check
    if (data.email === 'admin@bloodnet.com' && data.password === 'adminpass') {
        toast({
            title: 'Admin Login Successful!',
            description: 'Redirecting to the Admin Dashboard...',
        });
        sessionStorage.setItem('currentUserEmail', data.email);
        router.push('/dashboard');
        return;
    }
    
    const storedData = await getUser(data.email);

    if (!storedData) {
        toast({
            variant: 'destructive',
            title: 'Login Failed',
            description: 'No registration data found for this email. Please register first.',
        });
        return;
    }

    if (data.password !== storedData.password) {
         toast({
            variant: 'destructive',
            title: 'Login Failed',
            description: 'Invalid password.',
        });
        return;
    }

    toast({
      title: 'Login Successful!',
      description: `Redirecting to your ${storedData.role} dashboard...`,
    });

    sessionStorage.setItem('currentUserEmail', storedData.email);

    const dashboardRoutes: Record<string, string> = {
      Admin: '/dashboard',
      Donor: '/dashboard/donor',
      Individual: '/dashboard/requester',
      Hospital: '/dashboard/hospital',
      'Blood Bank': '/dashboard/blood-bank',
    };
    const targetRoute = dashboardRoutes[storedData.role] || '/dashboard';
    
    router.push(targetRoute);
  };

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <div className="flex justify-center items-center mb-4">
          <Droplet className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-3xl font-bold font-headline text-foreground">
          Welcome Back
        </h1>
        <p className="text-muted-foreground mt-1">
          Enter your credentials to access your account.
        </p>
      </div>
      <Card className="shadow-xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardHeader>
              <CardTitle>Login</CardTitle>
              <CardDescription>
                Enter your email and password to log in.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="user@email.com" {...field} />
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
                      <div className="relative">
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="********"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground"
                        >
                          {showPassword ? (
                            <EyeOff className="h-5 w-5" />
                          ) : (
                            <Eye className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex-col items-stretch gap-4">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Logging in...' : 'Login'}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Don't have an account?{' '}
                <Link
                  href="/register"
                  className="font-semibold text-primary hover:underline"
                >
                  Register
                </Link>
              </p>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Suspense fallback={<div>Loading...</div>}>
        <LoginComponent />
      </Suspense>
    </div>
  );
}
