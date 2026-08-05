import React, { useState } from "react";
import { 
  useListScans, 
  useGetReportSummary,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, Filter, FileText, AlertTriangle } from "lucide-react";
import { formatDate, formatScore } from "@/lib/utils";

export default function Reports() {
  const [selectedScanId, setSelectedScanId] = useState<number | "">("");

  const { data: scansData, isLoading: isLoadingScans } = useListScans({ limit: 50 });

  const { data: report, isLoading: isLoadingReport } = useGetReportSummary(
    { scanId: typeof selectedScanId === 'number' ? selectedScanId : undefined },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { query: { enabled: typeof selectedScanId === 'number' } as any }
  );

  const handleDownloadCsv = async () => {
    if (!selectedScanId) return;
    const token = localStorage.getItem("sentinel_token");
    try {
      const response = await fetch(`/api/reports/csv?scanId=${selectedScanId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error("Failed to download CSV");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sentinel-report-scan-${selectedScanId}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error(error);
    }
  };

  const completedScans = scansData?.data.filter(s => s.status === 'completed') || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Reports</h1>
          <p className="text-muted-foreground">Generate and export detailed compliance reports.</p>
        </div>
      </div>

      <Card className="bg-muted/10 border-dashed">
        <div className="p-6 flex flex-col md:flex-row gap-4 items-end md:items-center justify-between">
          <div className="w-full md:w-96 space-y-2">
            <label className="text-sm font-medium">Select a completed scan</label>
            {isLoadingScans ? (
              <div className="h-10 border rounded-md flex items-center px-3 bg-muted/50 text-muted-foreground">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading scans...
              </div>
            ) : (
              <select 
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={selectedScanId}
                onChange={(e) => setSelectedScanId(e.target.value ? parseInt(e.target.value) : "")}
              >
                <option value="">-- Choose a scan --</option>
                {completedScans.map(scan => (
                  <option key={scan.id} value={scan.id}>
                    {scan.accountName} - {formatDate(scan.startedAt)} (Score: {scan.overallScore})
                  </option>
                ))}
              </select>
            )}
          </div>
          
          <Button 
            onClick={handleDownloadCsv} 
            disabled={!selectedScanId}
            className="w-full md:w-auto"
          >
            <Download className="h-4 w-4 mr-2" /> Download CSV
          </Button>
        </div>
      </Card>

      {!selectedScanId ? (
        <div className="py-20 flex flex-col items-center justify-center text-center text-muted-foreground">
          <FileText className="h-12 w-12 mb-4 opacity-20" />
          <p>Select a scan from the dropdown above to view its report summary.</p>
        </div>
      ) : isLoadingReport ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : report ? (
        <div className="space-y-6">
          {/* Executive Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6 flex flex-col items-center justify-center text-center">
                <p className="text-sm font-medium text-muted-foreground mb-1">Overall Score</p>
                <p className="text-4xl font-bold font-display">{formatScore(report.scan.overallScore)}</p>
              </CardContent>
            </Card>
            <Card className="bg-destructive/5 border-destructive/20">
              <CardContent className="p-6 flex flex-col items-center justify-center text-center">
                <p className="text-sm font-medium text-destructive mb-1">Critical Issues</p>
                <p className="text-4xl font-bold text-destructive">{report.scan.criticalCount}</p>
              </CardContent>
            </Card>
            <Card className="bg-orange-500/5 border-orange-500/20">
              <CardContent className="p-6 flex flex-col items-center justify-center text-center">
                <p className="text-sm font-medium text-orange-600 mb-1">High Issues</p>
                <p className="text-4xl font-bold text-orange-600">{report.scan.highCount}</p>
              </CardContent>
            </Card>
            <Card className="bg-amber-500/5 border-amber-500/20">
              <CardContent className="p-6 flex flex-col items-center justify-center text-center">
                <p className="text-sm font-medium text-amber-600 mb-1">Medium Issues</p>
                <p className="text-4xl font-bold text-amber-600">{report.scan.mediumCount}</p>
              </CardContent>
            </Card>
          </div>

          {/* Finding Breakdown */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" /> 
              Critical Findings
            </h3>
            {report.criticalFindings.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No critical findings.</p>
            ) : (
              <div className="grid gap-3">
                {report.criticalFindings.map(f => (
                  <Card key={f.id} className="border-destructive/30">
                    <div className="p-4">
                      <div className="font-semibold">{f.title}</div>
                      <div className="text-sm text-muted-foreground mt-1">{f.description}</div>
                      <div className="mt-3 text-xs font-mono bg-muted p-2 rounded">{f.affectedResource}</div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-bold flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-5 w-5" /> 
              High Findings
            </h3>
            {report.highFindings.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No high findings.</p>
            ) : (
              <div className="grid gap-3">
                {report.highFindings.map(f => (
                  <Card key={f.id} className="border-orange-500/30">
                    <div className="p-4">
                      <div className="font-semibold">{f.title}</div>
                      <div className="text-sm text-muted-foreground mt-1">{f.description}</div>
                      <div className="mt-3 text-xs font-mono bg-muted p-2 rounded">{f.affectedResource}</div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-bold flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" /> 
              Medium Findings
            </h3>
            {report.mediumFindings.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No medium findings.</p>
            ) : (
              <div className="grid gap-3">
                {report.mediumFindings.map(f => (
                  <Card key={f.id} className="border-amber-500/30">
                    <div className="p-4">
                      <div className="font-semibold">{f.title}</div>
                      <div className="text-sm text-muted-foreground mt-1">{f.description}</div>
                      <div className="mt-3 text-xs font-mono bg-muted p-2 rounded">{f.affectedResource}</div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

        </div>
      ) : null}
    </div>
  );
}
