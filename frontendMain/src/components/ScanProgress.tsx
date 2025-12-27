import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScanStatus } from "@/hooks/useGmailScan";
import { AlertCircle, CheckCircle2, XCircle, Clock } from "lucide-react";

interface ScanProgressProps {
  status: ScanStatus | null;
  isLoading?: boolean;
}

export function ScanProgress({ status, isLoading }: ScanProgressProps) {
  if (!status && !isLoading) {
    return null;
  }

  const progress = status?.progress || {
    totalMessages: 0,
    processedMessages: 0,
    foundCandidates: 0,
    pendingReview: 0,
    verified: 0,
    declined: 0,
  };

  const progressPercent =
    progress.totalMessages > 0
      ? Math.round((progress.processedMessages / progress.totalMessages) * 100)
      : 0;

  const isRunning = status?.status === "running" || isLoading;
  const isCompleted = status?.status === "completed";
  const isFailed = status?.status === "failed";

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-card">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Scan Progress</h3>
        {isLoading && !status && <Badge variant="outline" className="gap-1">
          <Clock className="h-3 w-3 animate-spin" />
          Starting...
        </Badge>}
        {isRunning && status && <Badge variant="outline" className="gap-1">
          <Clock className="h-3 w-3" />
          Running
        </Badge>}
        {isCompleted && <Badge variant="outline" className="gap-1 text-green-600">
          <CheckCircle2 className="h-3 w-3" />
          Completed
        </Badge>}
        {isFailed && <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          Failed
        </Badge>}
      </div>

      {(isRunning || isLoading) && (
        <>
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{isLoading && !status ? "Starting scan..." : "Processing emails..."}</span>
              <span>
                {progress.processedMessages} / {progress.totalMessages || "—"}
              </span>
            </div>
            <Progress value={progressPercent || (isLoading && !status ? 10 : 0)} className="h-2" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <div>
              <div className="text-muted-foreground text-xs">Found</div>
              <div className="font-semibold">{progress.foundCandidates}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Pending Review</div>
              <div className="font-semibold text-yellow-600">{progress.pendingReview}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Verified</div>
              <div className="font-semibold text-green-600">{progress.verified}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Declined</div>
              <div className="font-semibold text-muted-foreground">{progress.declined}</div>
            </div>
          </div>

          {progress.pendingReview > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>{progress.pendingReview} item{progress.pendingReview !== 1 ? "s" : ""}</strong> need
                your review. Check the review drawer below.
              </AlertDescription>
            </Alert>
          )}
        </>
      )}

      {isCompleted && (
        <div className="text-sm text-muted-foreground">
          Scan completed. Found {progress.foundCandidates} candidate{progress.foundCandidates !== 1 ? "s" : ""}.
          {progress.pendingReview > 0 && (
            <span className="text-yellow-600 font-semibold">
              {" "}
              {progress.pendingReview} pending review.
            </span>
          )}
        </div>
      )}

      {isFailed && status.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{status.error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

