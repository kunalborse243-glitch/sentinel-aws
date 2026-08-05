import React from "react";
import { Link } from "wouter";
import { 
  useGetDashboardSummary, 
  getGetDashboardSummaryQueryKey 
} from "@workspace/api-client-react";
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription 
} from "@/components/ui/card";
import { CircularProgress } from "@/components/ui/circular-progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { formatDate, formatScore } from "@/lib/utils";
import { 
  ShieldAlert, ShieldCheck, Activity, Cloud, ArrowRight, Loader2
} from "lucide-react";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from "recharts";

export default function Dashboard() {
  const { data: summary, isLoading } = useGetDashboardSummary({});

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  const hasData = summary.totalAccounts > 0 && summary.totalScans > 0;

  if (!hasData) {
    return (
      <div className="flex-1 flex items-center justify-center py-12">
        <div className="max-w-md text-center">
          <div className="h-16 w-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-6">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-display font-bold mb-2">Welcome to Sentinel AWS</h2>
          <p className="text-muted-foreground mb-8">
            Your workspace is ready. Add your first AWS account and run a scan to see your security posture here.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/accounts">
              <Button>Add AWS Account</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const severityData = [
    { name: 'Critical', value: summary.criticalCount, fill: 'hsl(var(--destructive))' },
    { name: 'High', value: summary.highCount, fill: '#f97316' },
    { name: 'Medium', value: summary.mediumCount, fill: '#f59e0b' },
    { name: 'Low', value: summary.lowCount, fill: 'hsl(var(--primary))' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold">Overview</h1>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>{summary.totalAccounts} Accounts</span>
          <span>•</span>
          <span>Last scan: {summary.lastScanAt ? formatDate(summary.lastScanAt) : 'Never'}</span>
          <Link href="/scan">
            <Button size="sm">Start New Scan</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Overall Score */}
        <Card className="flex flex-col items-center justify-center p-6">
          <CardTitle className="mb-6 self-start w-full">Overall Security Score</CardTitle>
          <CircularProgress value={summary.overallScore || 0} size={160} strokeWidth={12} />
          <p className="text-sm text-muted-foreground mt-6 text-center">
            Based on the latest scans across all connected AWS accounts.
          </p>
        </Card>

        {/* Severity Breakdown */}
        <Card className="col-span-1 md:col-span-2">
          <CardHeader>
            <CardTitle>Open Findings by Severity</CardTitle>
          </CardHeader>
          <CardContent className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={severityData} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                  {severityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Score History */}
        <Card>
          <CardHeader>
            <CardTitle>Score History</CardTitle>
          </CardHeader>
          <CardContent className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={summary.scoreHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(val) => {
                    const d = new Date(val);
                    return `${d.getMonth()+1}/${d.getDate()}`;
                  }}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12 }}
                  dy={10}
                />
                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <Tooltip 
                  labelFormatter={(val) => formatDate(val)}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, fill: 'hsl(var(--primary))' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Service Scores */}
        <Card>
          <CardHeader>
            <CardTitle>Scores by Service</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {summary.serviceScores.map(svc => (
                <div key={svc.service} className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 text-sm font-semibold">{formatScore(svc.score)}</div>
                    <div>
                      <div className="font-medium capitalize">{svc.service.replace('_', ' ')}</div>
                      <div className="text-xs text-muted-foreground flex gap-2">
                        {svc.criticalCount > 0 && <span className="text-destructive">{svc.criticalCount} crit</span>}
                        {svc.highCount > 0 && <span className="text-orange-500">{svc.highCount} high</span>}
                        {svc.mediumCount > 0 && <span className="text-amber-500">{svc.mediumCount} med</span>}
                        {svc.lowCount > 0 && <span className="text-primary">{svc.lowCount} low</span>}
                        {(svc.criticalCount + svc.highCount + svc.mediumCount + svc.lowCount) === 0 && <span>No findings</span>}
                      </div>
                    </div>
                  </div>
                  <Link href={`/findings?service=${svc.service}`}>
                    <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between py-4">
            <CardTitle>Recent Scans</CardTitle>
            <Link href="/history">
              <Button variant="ghost" size="sm">View All</Button>
            </Link>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Score</TableHead>
                <TableHead className="text-right">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.recentScans.slice(0, 5).map(scan => (
                <TableRow key={scan.id}>
                  <TableCell className="font-medium">{scan.accountName}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={
                      scan.status === 'completed' ? 'text-emerald-600 bg-emerald-500/10' :
                      scan.status === 'running' ? 'text-primary bg-primary/10' :
                      scan.status === 'failed' ? 'text-destructive bg-destructive/10' : ''
                    }>
                      {scan.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatScore(scan.overallScore)}</TableCell>
                  <TableCell className="text-right text-muted-foreground text-xs">
                    {formatDate(scan.startedAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between py-4">
            <CardTitle>Recent Findings</CardTitle>
            <Link href="/findings">
              <Button variant="ghost" size="sm">View All</Button>
            </Link>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead className="text-right">Service</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.recentFindings.slice(0, 5).map(finding => (
                <TableRow key={finding.id}>
                  <TableCell className="font-medium max-w-[200px] truncate" title={finding.title}>
                    {finding.title}
                  </TableCell>
                  <TableCell>
                    <Badge variant="severity" severity={finding.severity}>
                      {finding.severity}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right capitalize text-muted-foreground text-xs">
                    {finding.service.replace('_', ' ')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
