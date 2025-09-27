'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { MailCheck, LoaderCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

function VerificationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isVerifying, setIsVerifying] = useState(true);

  const email = searchParams.get('email');

  useEffect(() => {
    if (!email) {
      // Redirect or show error if email is not present
      router.push('/register');
      return;
    }

    const timer = setTimeout(() => {
      setIsVerifying(false);
      toast({
        title: 'Verification Complete!',
        description: 'You can now log in to your account.',
      });
    }, 3000); 

    return () => clearTimeout(timer);
  }, [toast, router, email]);
  
  const getLoginUrl = () => {
    const loginParams = new URLSearchParams();
    if (email) {
        loginParams.set('email', email);
    }
    return `/login?${loginParams.toString()}`;
  }

  return (
    <div className="w-full max-w-md">
      <Card className="shadow-xl text-center">
        <CardHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
            {isVerifying ? (
              <LoaderCircle className="h-6 w-6 animate-spin text-primary" />
            ) : (
              <MailCheck className="h-6 w-6 text-primary" />
            )}
          </div>
          <CardTitle className="text-2xl">
            {isVerifying ? 'Verifying Your Account...' : 'Account Verified!'}
          </CardTitle>
          <CardDescription>
            {isVerifying
              ? 'Please wait while we confirm your registration. This is a mocked process and will complete automatically.'
              : 'Your account has been successfully created and verified.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isVerifying ? (
            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="h-2 w-full max-w-xs bg-muted rounded-full overflow-hidden">
                  <div className="h-2 bg-primary animate-pulse w-full"></div>
              </div>
              <p className="text-sm text-muted-foreground">
                This shouldn't take long.
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground">
              Thank you for joining the Centralized Blood Donation System.
            </p>
          )}
        </CardContent>
        {!isVerifying && (
          <CardFooter>
            <Link 
              href={getLoginUrl()} 
              className="w-full"
            >
              <Button className="w-full">Proceed to Login</Button>
            </Link>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}


export default function VerificationPage() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
            <Suspense fallback={<div>Loading...</div>}>
                <VerificationContent />
            </Suspense>
        </div>
    )
}
