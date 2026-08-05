import React, { useState } from "react";
import { Link } from "wouter";
import { 
  useListScans,
  useCompareScan
} from "@workspace/api-client-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowRightLeft, Calendar, ShieldCheck, ShieldAlert, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { formatDate, formatScore } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function History() {
  const [page, setPage] = useState(1);
  const { data: scansData, isLoading } = useListScans({ page, limit: 10 });
  const [compareScanIds, setCompareScanIds] = useState<{current: number, previous: number} | null>(null);

  const { data: comparison, isLoading: isComparing } = useCompareScan(
    compareScanIds?.current || 0,
    compareScanIds?.previous || 0,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { query: { enabled: !!compareScanIds } as any }
  );

  const handleCompare = (currentScan: any, allScans: any[]) => {
    // Find the immediately preceding scan for the same account
    const previousScan = allScans.find(s => 
      s.accountId === currentScan.accountId && 
      new Date(s.startedAt) < new Date(currentScan.startedAt) &&
      s.status === 'completed'
    );
    
    if (previousScan) {
      setCompareScanIds({ current: currentScan.id, previous: previousScan.id });
    } else {
      // Just open comparison with self if no previous (or could show a toast saying "No previous scan")
      setCompareScanIds({ current: currentScan.id, previous: currentScan.id });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Scan History</h1>
        <p className="text-muted-foreground">Review past audits and compare changes over time.</p>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Findings</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Compare</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                </TableCell>
              </TableRow>
            ) : scansData?.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  No scans have been run yet.
                </TableCell>
              </TableRow>
            ) : (
              scansData?.data.map((scan) => (
                <TableRow key={scan.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {formatDate(scan.startedAt)}
                    </div>
                  </TableCell>
                  <TableCell>{scan.accountName}</TableCell>
                  <TableCell>
                    {scan.overallScore !== null ? (
                      <span className="font-bold font-mono">{scan.overallScore}</span>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 text-xs font-mono">
                      {scan.status === 'completed' ? (
                        <>
                          <span className="text-destructive w-6 text-center">{scan.criticalCount}</span>
                          <span className="text-orange-500 w-6 text-center">{scan.highCount}</span>
                          <span className="text-amber-500 w-6 text-center">{scan.mediumCount}</span>
                        </>
                      ) : "—"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={
                      scan.status === 'completed' ? 'text-emerald-600 bg-emerald-500/10' :
                      scan.status === 'running' ? 'text-primary bg-primary/10' :
                      scan.status === 'failed' ? 'text-destructive bg-destructive/10' : ''
                    }>
                      {scan.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      disabled={scan.status !== 'completed'}
                      onClick={() => handleCompare(scan, scansData.data)}
                    >
                      <ArrowRightLeft className="h-4 w-4 mr-2" /> Compare
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {scansData && scansData.totalPages > 1 && (
          <div className="p-4 border-t flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Showing page {scansData.page} of {scansData.totalPages}
            </span>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                Previous
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                disabled={page === scansData.totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Dialog open={!!compareScanIds} onOpenChange={(open) => !open && setCompareScanIds(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Scan Comparison</DialogTitle>
          </DialogHeader>
          
          {isComparing ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : comparison ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-muted/30 border-dashed">
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm text-muted-foreground">Previous Scan</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <div className="text-2xl font-bold font-display">{formatScore(comparison.previous.overallScore)}</div>
                    <div className="text-xs text-muted-foreground mt-1">{formatDate(comparison.previous.startedAt)}</div>
                  </CardContent>
                </Card>
                <Card className="bg-primary/5 border-primary/20">
                  <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm text-primary">Current Scan</CardTitle>
                    {comparison.scoreDelta !== 0 && (
                      <Badge variant="outline" className={comparison.scoreDelta > 0 ? "text-emerald-500 border-emerald-200" : "text-destructive border-destructive/20"}>
                        {comparison.scoreDelta > 0 ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
                        {Math.abs(comparison.scoreDelta)} pts
                      </Badge>
                    )}
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <div className="text-2xl font-bold font-display">{formatScore(comparison.current.overallScore)}</div>
                    <div className="text-xs text-muted-foreground mt-1">{formatDate(comparison.current.startedAt)}</div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="flex items-center gap-2 font-semibold text-sm mb-3 text-destructive">
                    <ShieldAlert className="h-4 w-4" /> New Findings ({comparison.newFindings.length})
                  </h4>
                  {comparison.newFindings.length > 0 ? (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                      {comparison.newFindings.map(f => (
                        <div key={f.id} className="p-3 bg-card border rounded-lg text-sm">
                          <div className="font-medium truncate mb-1">{f.title}</div>
                          <Badge variant="severity" severity={f.severity} className="text-[10px] py-0">{f.severity}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No new findings introduced.</p>
                  )}
                </div>
                <div>
                  <h4 className="flex items-center gap-2 font-semibold text-sm mb-3 text-emerald-500">
                    <ShieldCheck className="h-4 w-4" /> Resolved Findings ({comparison.resolvedFindings.length})
                  </h4>
                  {comparison.resolvedFindings.length > 0 ? (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                      {comparison.resolvedFindings.map(f => (
                        <div key={f.id} className="p-3 bg-card border rounded-lg text-sm opacity-70">
                          <div className="font-medium truncate line-through mb-1">{f.title}</div>
                          <Badge variant="outline" className="text-[10px] py-0">{f.severity}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No findings were resolved.</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              Comparison not available (only one scan exists).
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
