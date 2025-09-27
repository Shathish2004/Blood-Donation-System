
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Building,
  HeartHandshake,
  TestTube2,
  User,
  Droplet,
  LogIn,
  UserPlus,
} from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  const roles = [
    {
      href: '/dashboard/requester',
      title: 'I Need Blood',
      description: 'Request blood for yourself or a loved one.',
      icon: User,
    },
    {
      href: '/dashboard/donor',
      title: "I'm a Donor",
      description: 'Update your availability and see your donation history.',
      icon: HeartHandshake,
    },
    {
      href: '/dashboard/hospital',
      title: "I'm a Hospital",
      description: 'Manage your blood inventory and view requests.',
      icon: Building,
    },
    {
      href: '/dashboard/blood-bank',
      title: "I'm a Blood Bank",
      description: 'Oversee inventory and match requests with available units.',
      icon: TestTube2,
    },
  ];

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4">
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/10 via-background to-accent/10 -z-10"></div>
      <div className="text-center mb-12">
        <div className="flex justify-center items-center mb-4">
          <Droplet className="h-12 w-12 text-primary" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold font-headline text-foreground">
          Centralized Blood Donation System
        </h1>
        <p className="text-lg text-muted-foreground mt-2">
          Connecting donors, patients, and healthcare providers seamlessly.
        </p>
      </div>
      <Card className="w-full max-w-sm shadow-xl">
        <CardHeader>
          <CardTitle className="text-center text-2xl font-headline">Get Started</CardTitle>
          <CardDescription className="text-center">
            Login or create a new account to continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
           <Link href="/login">
             <Button asChild className="w-full">
                <span>
                  <LogIn className="mr-2" />
                  Login
                </span>
            </Button>
          </Link>
          <Link href="/register">
             <Button asChild variant="outline" className="w-full">
                <span>
                  <UserPlus className="mr-2" />
                  Register
                </span>
            </Button>
          </Link>
        </CardContent>
      </Card>
      <footer className="mt-12 text-center text-muted-foreground text-sm">
        <p>Your contribution can save a life. Thank you for your support.</p>
      </footer>
    </div>
  );
}
