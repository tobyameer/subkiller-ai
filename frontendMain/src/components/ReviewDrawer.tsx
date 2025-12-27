import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useVerifyReviewItem, useDeclineReviewItem, ReviewItem } from "@/hooks/useGmailScan";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2, ChevronDown, ChevronUp } from "lucide-react";

interface ReviewDrawerProps {
  item: ReviewItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResolved: () => void;
}

export function ReviewDrawer({ item, open, onOpenChange, onResolved }: ReviewDrawerProps) {
  const [alwaysIgnoreSender, setAlwaysIgnoreSender] = useState(false);
  const [showEditDetails, setShowEditDetails] = useState(false);
  const [edits, setEdits] = useState<{
    service?: string;
    amount?: number;
    billingCycle?: string;
    category?: string;
  }>({});

  const verifyMutation = useVerifyReviewItem();
  const declineMutation = useDeclineReviewItem();

  if (!item) {
    return null;
  }

  const aiExtracted = item.aiExtracted || {};

  const handleVerify = async () => {
    try {
      await verifyMutation.mutateAsync({
        id: item._id,
        edits: showEditDetails && Object.keys(edits).length > 0 ? edits : undefined,
        alwaysIgnoreSender,
      });
      toast.success("Subscription verified and added");
      setAlwaysIgnoreSender(false);
      setEdits({});
      setShowEditDetails(false);
      onResolved();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error?.message || "Failed to verify subscription");
    }
  };

  const handleDecline = async () => {
    try {
      await declineMutation.mutateAsync({
        id: item._id,
        alwaysIgnoreSender,
      });
      toast.success("Item declined");
      setAlwaysIgnoreSender(false);
      onResolved();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error?.message || "Failed to decline item");
    }
  };

  const isLoading = verifyMutation.isPending || declineMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Confirm this is a subscription?</DialogTitle>
          <DialogDescription>
            Review the email below to verify if this is a subscription you want to track.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {/* Email Details */}
          <div className="space-y-2">
            <div className="p-3 bg-muted rounded-lg space-y-1 text-sm">
              <div>
                <span className="text-muted-foreground font-medium">From:</span>{" "}
                <span className="font-semibold">{item.from}</span>
              </div>
              <div>
                <span className="text-muted-foreground font-medium">Subject:</span>{" "}
                <span className="font-semibold">{item.subject}</span>
              </div>
              {item.date && (
                <div>
                  <span className="text-muted-foreground font-medium">Date:</span>{" "}
                  {new Date(item.date).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>

          {/* Email Body */}
          {item.cleanedPreview && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Email Content</h3>
              <ScrollArea className="h-64 p-4 bg-muted rounded-lg text-sm border">
                <pre className="whitespace-pre-wrap font-sans text-foreground">
                  {item.cleanedPreview}
                </pre>
              </ScrollArea>
            </div>
          )}

          {/* Optional Edit Details */}
          <Collapsible open={showEditDetails} onOpenChange={setShowEditDetails}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between">
                <span>Edit details (optional)</span>
                {showEditDetails ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 p-4 border rounded-lg">
              <div className="space-y-2">
                <Label htmlFor="service">Service</Label>
                <Input
                  id="service"
                  value={edits.service || aiExtracted.service || item.service || ""}
                  onChange={(e) => setEdits({ ...edits, service: e.target.value })}
                  placeholder="Service name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={
                    edits.amount !== undefined
                      ? edits.amount
                      : aiExtracted.amount || item.amount || 0
                  }
                  onChange={(e) =>
                    setEdits({ ...edits, amount: parseFloat(e.target.value) || 0 })
                  }
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="billingCycle">Billing Cycle</Label>
                <Select
                  value={
                    edits.billingCycle || aiExtracted.billingCycle || "monthly"
                  }
                  onValueChange={(value) => setEdits({ ...edits, billingCycle: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="one_time">One-time</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={
                    edits.category || aiExtracted.category || item.category || "Other"
                  }
                  onValueChange={(value) => setEdits({ ...edits, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Streaming">Streaming</SelectItem>
                    <SelectItem value="Music">Music</SelectItem>
                    <SelectItem value="Gaming">Gaming</SelectItem>
                    <SelectItem value="Productivity">Productivity</SelectItem>
                    <SelectItem value="Cloud">Cloud</SelectItem>
                    <SelectItem value="Finance">Finance</SelectItem>
                    <SelectItem value="Fitness">Fitness</SelectItem>
                    <SelectItem value="Retail">Retail</SelectItem>
                    <SelectItem value="Food">Food</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Always Ignore Checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="alwaysIgnore"
              checked={alwaysIgnoreSender}
              onCheckedChange={(checked) => setAlwaysIgnoreSender(checked === true)}
              disabled={isLoading}
            />
            <Label htmlFor="alwaysIgnore" className="text-sm cursor-pointer">
              Always ignore this sender
            </Label>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-4 border-t">
          <Button
            onClick={handleDecline}
            disabled={isLoading}
            variant="outline"
            className="flex-1"
            size="lg"
          >
            {isLoading && declineMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <XCircle className="h-4 w-4 mr-2" />
            )}
            No, ignore
          </Button>
          <Button
            onClick={handleVerify}
            disabled={isLoading}
            className="flex-1"
            size="lg"
          >
            {isLoading && verifyMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-2" />
            )}
            Yes, it's a subscription
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
