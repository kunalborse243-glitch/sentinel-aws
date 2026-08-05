import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useListAccounts, useCreateAccount, useUpdateAccount, useDeleteAccount, useTestAccountConnection,
  getListAccountsQueryKey
} from "@workspace/api-client-react";
import { toast } from "sonner";
import { Loader2, Plus, Cloud, MoreHorizontal, Pencil, Trash2, ShieldCheck, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate, formatScore } from "@/lib/utils";

const accountSchema = z.object({
  name: z.string().min(1, "Name is required"),
  accessKeyId: z.string().min(1, "Access Key ID is required"),
  secretAccessKey: z.string().min(1, "Secret Access Key is required"),
  region: z.string().min(1, "Region is required"),
});

type AccountFormValues = z.infer<typeof accountSchema>;

export default function Accounts() {
  const queryClient = useQueryClient();
  const { data: accounts, isLoading } = useListAccounts();
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();
  const deleteAccount = useDeleteAccount();
  const testConnection = useTestAccountConnection();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const { register, handleSubmit, reset, formState: { errors }, setValue } = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: "",
      accessKeyId: "",
      secretAccessKey: "",
      region: "us-east-1",
    }
  });

  const openAddDialog = () => {
    setEditingId(null);
    reset({ name: "", accessKeyId: "", secretAccessKey: "", region: "us-east-1" });
    setIsDialogOpen(true);
  };

  const openEditDialog = (account: any) => {
    setEditingId(account.id);
    reset({
      name: account.name,
      accessKeyId: account.accessKeyId,
      secretAccessKey: "", // Need to re-enter
      region: account.region,
    });
    setIsDialogOpen(true);
  };

  const onSubmit = async (data: AccountFormValues) => {
    try {
      if (editingId) {
        await updateAccount.mutateAsync({ id: editingId, data });
        toast.success("Account updated successfully");
      } else {
        await createAccount.mutateAsync({ data });
        toast.success("Account added successfully");
      }
      queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
      setIsDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to save account");
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this account? All associated scans and findings will be deleted. This cannot be undone.")) {
      return;
    }
    try {
      await deleteAccount.mutateAsync({ id });
      toast.success("Account deleted");
      queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
    } catch (error: any) {
      toast.error(error.message || "Failed to delete account");
    }
  };

  const handleTest = async (id: number) => {
    try {
      const result = await testConnection.mutateAsync({ id });
      if (result.success) {
        toast.success(result.message || "Connection successful");
      } else {
        toast.error(result.message || "Connection failed");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to test connection");
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">AWS Accounts</h1>
          <p className="text-muted-foreground">Manage your connected AWS environments.</p>
        </div>
        <Button onClick={openAddDialog}>
          <Plus className="h-4 w-4 mr-2" /> Add Account
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account Name</TableHead>
              <TableHead>AWS Access Key ID</TableHead>
              <TableHead>Region</TableHead>
              <TableHead>Last Scan</TableHead>
              <TableHead>Latest Score</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  <Cloud className="h-8 w-8 mx-auto mb-4 opacity-50" />
                  <p>No AWS accounts connected yet.</p>
                  <Button variant="link" onClick={openAddDialog} className="mt-2">Add your first account</Button>
                </TableCell>
              </TableRow>
            )}
            {accounts?.map((acc) => (
              <TableRow key={acc.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Cloud className="h-4 w-4 text-muted-foreground" />
                    {acc.name}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs">{acc.accessKeyId}</TableCell>
                <TableCell>{acc.region}</TableCell>
                <TableCell className="text-muted-foreground">
                  {acc.lastScanAt ? formatDate(acc.lastScanAt) : "Never"}
                </TableCell>
                <TableCell>
                  {acc.lastScore !== null ? (
                    <Badge variant="outline" className={
                      (acc.lastScore ?? 0) >= 85 ? "bg-emerald-500/10 text-emerald-600" :
                      (acc.lastScore ?? 0) >= 70 ? "bg-amber-500/10 text-amber-600" :
                      (acc.lastScore ?? 0) >= 50 ? "bg-orange-500/10 text-orange-600" :
                      "bg-destructive/10 text-destructive"
                    }>
                      {acc.lastScore}/100
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleTest(acc.id)} disabled={testConnection.isPending && testConnection.variables?.id === acc.id}>
                      {testConnection.isPending && testConnection.variables?.id === acc.id ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <ShieldCheck className="h-3 w-3 mr-1" />
                      )}
                      Test
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(acc)}>
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(acc.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit AWS Account" : "Add AWS Account"}</DialogTitle>
            <DialogDescription>
              Provide IAM credentials with read-only access to audit your environment.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Friendly Name</Label>
              <Input id="name" placeholder="Production Env" {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="accessKeyId">Access Key ID</Label>
              <Input id="accessKeyId" placeholder="AKIAIOSFODNN7EXAMPLE" {...register("accessKeyId")} />
              {errors.accessKeyId && <p className="text-xs text-destructive">{errors.accessKeyId.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="secretAccessKey">Secret Access Key {editingId && "(Required to update)"}</Label>
              <Input id="secretAccessKey" type="password" placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY" {...register("secretAccessKey")} />
              {errors.secretAccessKey && <p className="text-xs text-destructive">{errors.secretAccessKey.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="region">Default Region</Label>
              <Input id="region" placeholder="us-east-1" {...register("region")} />
              {errors.region && <p className="text-xs text-destructive">{errors.region.message}</p>}
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createAccount.isPending || updateAccount.isPending}>
                {(createAccount.isPending || updateAccount.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingId ? "Save Changes" : "Add Account"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
