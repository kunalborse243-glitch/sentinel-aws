import React, { useState } from "react";
import { 
  useListFindings,
  FindingSeverity,
  FindingService
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, Filter, ShieldAlert, FileJson } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export default function Findings() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState<string>("");
  const [service, setService] = useState<string>("");
  const [selectedFinding, setSelectedFinding] = useState<any | null>(null);

  const { data: findingsData, isLoading } = useListFindings({
    page,
    limit: 20,
    search: search || undefined,
    severity: severity ? (severity as FindingSeverity) : undefined,
    service: service ? (service as FindingService) : undefined,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Findings</h1>
        <p className="text-muted-foreground">Detailed view of all security misconfigurations.</p>
      </div>

      <Card>
        <div className="p-4 border-b flex flex-col md:flex-row gap-4 items-center justify-between bg-muted/20">
          <div className="flex-1 w-full relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search findings by title or resource..." 
              className="pl-9 bg-background"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <div className="flex w-full md:w-auto gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select 
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={severity}
                onChange={(e) => { setSeverity(e.target.value); setPage(1); }}
              >
                <option value="">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
                <option value="informational">Informational</option>
              </select>
            </div>
            <select 
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              value={service}
              onChange={(e) => { setService(e.target.value); setPage(1); }}
            >
              <option value="">All Services</option>
              <option value="iam">IAM</option>
              <option value="s3">S3</option>
              <option value="ec2">EC2</option>
              <option value="security_groups">Security Groups</option>
              <option value="cloudtrail">CloudTrail</option>
            </select>
          </div>
        </div>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : findingsData?.data.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center px-4">
              <div className="h-16 w-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mb-4">
                <ShieldAlert className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold mb-2">No findings match your criteria</h3>
              <p className="text-muted-foreground">You are all clear or your search is too restrictive.</p>
              {(search || severity || service) && (
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => { setSearch(""); setSeverity(""); setService(""); setPage(1); }}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y">
              {findingsData?.data.map((finding) => (
                <div 
                  key={finding.id} 
                  className="p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => setSelectedFinding(finding)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <Badge variant="severity" severity={finding.severity}>
                          {finding.severity}
                        </Badge>
                        <h4 className="font-semibold text-sm truncate">{finding.title}</h4>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                        {finding.description}
                      </p>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="flex items-center text-muted-foreground">
                          <span className="font-medium mr-1 text-foreground">Service:</span> 
                          <span className="capitalize">{finding.service.replace('_', ' ')}</span>
                        </span>
                        <span className="flex items-center text-muted-foreground truncate">
                          <span className="font-medium mr-1 text-foreground">Resource:</span> 
                          <span className="font-mono bg-muted px-1.5 py-0.5 rounded truncate max-w-[200px]">{finding.affectedResource}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {findingsData && findingsData.totalPages > 1 && (
            <div className="p-4 border-t flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Showing page {findingsData.page} of {findingsData.totalPages} ({findingsData.total} total)
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
                  disabled={page === findingsData.totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedFinding} onOpenChange={(open) => !open && setSelectedFinding(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedFinding && (
            <>
              <DialogHeader className="mb-4">
                <div className="flex items-center gap-3 mb-2">
                  <Badge variant="severity" severity={selectedFinding.severity}>
                    {selectedFinding.severity.toUpperCase()}
                  </Badge>
                  <span className="text-xs font-mono text-muted-foreground">{selectedFinding.checkId}</span>
                </div>
                <DialogTitle className="text-xl">{selectedFinding.title}</DialogTitle>
              </DialogHeader>

              <div className="space-y-6">
                <div>
                  <h4 className="font-semibold text-sm mb-1">Description</h4>
                  <p className="text-sm text-muted-foreground">{selectedFinding.description}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted/50 p-3 rounded-lg border border-border/50">
                    <span className="block text-xs font-medium text-muted-foreground mb-1">Service</span>
                    <span className="capitalize font-medium">{selectedFinding.service.replace('_', ' ')}</span>
                  </div>
                  <div className="bg-muted/50 p-3 rounded-lg border border-border/50 overflow-hidden">
                    <span className="block text-xs font-medium text-muted-foreground mb-1">Affected Resource</span>
                    <span className="font-mono text-xs truncate block" title={selectedFinding.affectedResource}>
                      {selectedFinding.affectedResource}
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-sm mb-2 text-primary">Recommendation</h4>
                  <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg text-sm leading-relaxed">
                    {selectedFinding.recommendation}
                  </div>
                </div>

                {selectedFinding.metadataJson && (
                  <div>
                    <h4 className="flex items-center gap-2 font-semibold text-sm mb-2">
                      <FileJson className="h-4 w-4" /> Raw Metadata
                    </h4>
                    <pre className="bg-black dark:bg-card text-emerald-400 dark:text-emerald-300 p-4 rounded-lg text-xs font-mono overflow-x-auto">
                      {JSON.stringify(JSON.parse(selectedFinding.metadataJson), null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
