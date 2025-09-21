'use client';

import * as React from 'react';
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  LoaderCircle,
  MoreHorizontal,
  ShieldBan,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getAllUsers, updateUserStatus, deleteUser, User } from '@/app/actions';
import { cn } from '@/lib/utils';
import { Suspense } from 'react';

function UserActions({ user, onAction }: { user: User; onAction: () => void }) {
  const { toast } = useToast();
  const [isBanAlertOpen, setIsBanAlertOpen] = React.useState(false);
  const [isUnbanAlertOpen, setIsUnbanAlertOpen] = React.useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = React.useState(false);

  const handleStatusChange = async (status: 'active' | 'banned') => {
    try {
      await updateUserStatus(user.email, status);
      toast({
        title: 'Success',
        description: `User has been ${status === 'active' ? 'unbanned' : 'banned'}.`,
      });
      onAction();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update user status.',
      });
    }
  };

  const handleDelete = async () => {
    try {
      await deleteUser(user.email);
      toast({
        title: 'Success',
        description: 'User has been deleted.',
      });
      onAction();
    } catch (error) {
       toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete user.',
      });
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          {user.status === 'banned' ? (
            <DropdownMenuItem onSelect={() => setIsUnbanAlertOpen(true)}>
              <CheckCircle2 className="mr-2 h-4 w-4" /> Unban User
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => setIsBanAlertOpen(true)}>
              <ShieldBan className="mr-2 h-4 w-4" /> Ban User
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive"
            onSelect={() => setIsDeleteAlertOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Delete User
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Alerts */}
      <AlertDialog open={isBanAlertOpen} onOpenChange={setIsBanAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to ban this user?</AlertDialogTitle>
            <AlertDialogDescription>
              This will prevent the user from accessing the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleStatusChange('banned')}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isUnbanAlertOpen} onOpenChange={setIsUnbanAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to unban this user?</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore the user's access to the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleStatusChange('active')}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to permanently delete this user?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All data associated with this user will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function UserManagementContent() {
  const [users, setUsers] = React.useState<User[]>([]);
  const [loading, setLoading] = React.useState(true);

  const fetchUsers = React.useCallback(async () => {
    setLoading(true);
    const allUsers = await getAllUsers();
    setUsers(allUsers.filter(u => u.role !== 'Admin')); // Don't show admin in the list
    setLoading(false);
  }, []);

  React.useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoaderCircle className="h-8 w-8 animate-spin" />
        <p className="ml-2">Loading users...</p>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Management</CardTitle>
        <CardDescription>
          Manage all registered users in the system.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.email}>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.role}</TableCell>
                <TableCell>
                  <Badge
                    variant={user.status === 'banned' ? 'destructive' : 'default'}
                    className={cn(user.status === 'active' && 'bg-green-500')}
                  >
                    {user.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <UserActions user={user} onAction={fetchUsers} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}


export default function UserManagementPage() {
    return (
        <Suspense fallback={
            <div className="flex h-full w-full items-center justify-center">
                 <LoaderCircle className="h-8 w-8 animate-spin" />
                 <p className="ml-2">Loading...</p>
            </div>
        }>
            <UserManagementContent />
        </Suspense>
    )
}
