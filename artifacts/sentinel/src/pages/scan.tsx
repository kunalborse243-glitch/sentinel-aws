import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  useListAccounts, 
  useStartScan, 
  useGetScan,
  StartScanRequestModulesItem
} from "@workspace/api-client-react";
import { toast } from "sonner";
import { Loader2, Play, ShieldAlert, Activity, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

const scanSchema = z.object({
  accountId: z.string().min(1, "Please select an account"),
  modules: z.array(z.string()).min(1, "Please select at least one module"),
});

type ScanFormValues = z.infer<typeof scanSchema>;

const AVAILABLE_MODULES = [
  { id: StartScanRequestModulesItem.iam, name: "IAM & Identity", desc: "Users, roles, and credential management" },
  { id: StartScanRequestModulesItem.s3, name: "S3 Storage", desc: "Bucket policies, encryption, and public access" },
  { id: StartScanRequestModulesItem.ec2, name: "EC2 & Compute", desc: "Instances, EBS volumes, and AMIs" },
  { id: StartScanRequestModulesItem.security_groups, name: "Networking", desc: "Security groups and open ports" },
  { id: StartScanRequestModulesItem.cloudtrail, name: "Logging & Monitoring", desc: "CloudTrail, Config, and GuardDuty" },
];

export default function Scan() {
  const [, setLocation] = useLocation();
  const { data: accounts, isLoading: isLoadingAccounts } = useListAccounts();
  const startScan = useStartScan();
  const [activeScanId, setActiveScanId] = useState<number | null>(null);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<ScanFormValues>({
    resolver: zodResolver(scanSchema),
    defaultValues: {
      accountId: "",
      modules: AVAILABLE_MODULES.map(m => m.id),
    }
  });

  const selectedModules = watch("modules");

  const { data: activeScan, refetch } = useGetScan(activeScanId || 0, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: {
      enabled: !!activeScanId,
      refetchInterval: (data: any) => {
        if (data?.state?.data?.status === 'completed' || data?.state?.data?.status === 'failed') return false;
        return 2000;
      }
    } as any
  });

  useEffect(() => {
    if (activeScan?.status === 'completed') {
      toast.success("Scan completed successfully!");
      // Could redirect or show results, but let's keep them here to see the 100% state
    } else if (activeScan?.status === 'failed') {
      toast.error(activeScan.errorMessage || "Scan failed");
      setActiveScanId(null);
    }
  }, [activeScan?.status, activeScan?.errorMessage]);

  const toggleModule = (moduleId: string) => {
    if (selectedModules.includes(moduleId)) {
      setValue("modules", selectedModules.filter(id => id !== moduleId));
    } else {
      setValue("modules", [...selectedModules, moduleId]);
    }
  };

  const onSubmit = async (data: ScanFormValues) => {
    try {
      const result = await startScan.mutateAsync({
        data: {
          accountId: parseInt(data.accountId),
          modules: data.modules as StartScanRequestModulesItem[]
        }
      });
      setActiveScanId(result.id);
      toast.info("Scan started. This may take a few minutes.");
    } catch (error: any) {
      toast.error(error.message || "Failed to start scan");
    }
  };

  if (isLoadingAccounts) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (accounts?.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center py-12">
        <div className="max-w-md text-center">
          <ShieldAlert className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">No Accounts Connected</h2>
          <p className="text-muted-foreground mb-6">
            You need to connect an AWS account before you can run a scan.
          </p>
          <Link href="/accounts">
            <Button>Go to AWS Accounts</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-display font-bold">Start New Scan</h1>
        <p className="text-muted-foreground">Select an account and modules to audit.</p>
      </div>

      {activeScanId && activeScan ? (
        <Card className="border-primary/50 shadow-md">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {activeScan.status === 'completed' ? (
                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                ) : (
                  <Activity className="h-6 w-6 text-primary animate-pulse" />
                )}
                <CardTitle>
                  {activeScan.status === 'completed' ? "Scan Complete" : "Scan in Progress"}
                </CardTitle>
              </div>
              <Badge variant="outline" className={
                activeScan.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600' :
                'bg-primary/10 text-primary'
              }>
                {activeScan.status.toUpperCase()}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-muted-foreground">
                  {activeScan.status === 'completed' 
                    ? "All checks passed successfully" 
                    : `Currently analyzing: ${activeScan.currentModule?.replace('_', ' ').toUpperCase() || 'Initializing...'}`}
                </span>
                <span className="font-medium">{activeScan.progress}%</span>
              </div>
              <Progress value={activeScan.progress} className="h-3" />
            </div>

            {activeScan.status === 'completed' && (
              <div className="pt-4 flex gap-4 border-t border-border">
                <Link href={`/findings?scanId=${activeScan.id}`}>
                  <Button variant="default">View Findings</Button>
                </Link>
                <Button variant="outline" onClick={() => setActiveScanId(null)}>Start Another Scan</Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
              
              {/* Account Selection */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">1. Select Target Account</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {accounts?.map(acc => (
                    <label key={acc.id} className="cursor-pointer">
                      <div className={`border rounded-lg p-4 transition-colors hover:border-primary/50 relative ${
                        watch("accountId") === acc.id.toString() ? "border-primary bg-primary/5 ring-1 ring-primary" : "bg-card"
                      }`}>
                        <input 
                          type="radio" 
                          value={acc.id.toString()} 
                          className="sr-only"
                          {...register("accountId")}
                        />
                        <div className="flex justify-between items-start mb-1">
                          <div className="font-medium">{acc.name}</div>
                          {acc.lastScore !== null && (
                            <Badge variant="outline" className="text-xs scale-90 origin-top-right">
                              Score: {acc.lastScore}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono truncate">{acc.accessKeyId}</div>
                      </div>
                    </label>
                  ))}
                </div>
                {errors.accountId && <p className="text-sm text-destructive">{errors.accountId.message}</p>}
              </div>

              {/* Modules Selection */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-lg font-semibold">2. Select Modules</h3>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setValue("modules", AVAILABLE_MODULES.map(m => m.id))}
                  >
                    Select All
                  </Button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {AVAILABLE_MODULES.map(module => {
                    const isSelected = selectedModules.includes(module.id);
                    return (
                      <div 
                        key={module.id}
                        onClick={() => toggleModule(module.id)}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          isSelected ? "border-primary bg-primary/5" : "hover:border-primary/30 hover:bg-muted/50"
                        }`}
                      >
                        <div className={`mt-0.5 h-5 w-5 rounded-sm border flex items-center justify-center shrink-0 ${
                          isSelected ? "bg-primary border-primary" : "border-input"
                        }`}>
                          {isSelected && <div className="h-2 w-2 rounded-sm bg-primary-foreground" />}
                        </div>
                        <div>
                          <div className="font-medium text-sm">{module.name}</div>
                          <div className="text-xs text-muted-foreground">{module.desc}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {errors.modules && <p className="text-sm text-destructive">{errors.modules.message}</p>}
              </div>

              <div className="pt-4 flex justify-end">
                <Button type="submit" size="lg" disabled={startScan.isPending}>
                  {startScan.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Launch Audit
                </Button>
              </div>

            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
