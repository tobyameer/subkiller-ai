import { useState } from "react";
import { useReviewItems, useVerifyReviewItem, useDeclineReviewItem, ReviewItem } from "@/hooks/useGmailScan";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2, Filter } from "lucide-react";
import { ReviewDrawer } from "@/components/ReviewDrawer";

const CONFIDENCE_COLORS: Record<number, string> = {
  1: "bg-gray-500",
  2: "bg-blue-500",
  3: "bg-yellow-500",
  4: "bg-orange-500",
  5: "bg-red-500",
};

const CONFIDENCE_LABELS: Record<number, string> = {
  1: "Very Low",
  2: "Low",
  3: "Medium",
  4: "High",
  5: "Critical",
};

export function ReviewInbox() {
  const [selectedLevel, setSelectedLevel] = useState<number | undefined>(undefined);
  const [selectedItem, setSelectedItem] = useState<ReviewItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: items = [], isLoading } = useReviewItems("pending", selectedLevel);
  const verifyMutation = useVerifyReviewItem();
  const declineMutation = useDeclineReviewItem();

  const handleVerify = async (item: ReviewItem) => {
    try {
      await verifyMutation.mutateAsync({ id: item._id });
      toast.success("Subscription verified");
      setSelectedItem(null);
      setDrawerOpen(false);
    } catch (error: any) {
      toast.error(error?.message || "Failed to verify");
    }
  };

  const handleDecline = async (item: ReviewItem) => {
    try {
      await declineMutation.mutateAsync({ id: item._id });
      toast.success("Item declined");
      setSelectedItem(null);
      setDrawerOpen(false);
    } catch (error: any) {
      toast.error(error?.message || "Failed to decline");
    }
  };

  const handleBulkDecline = async (level: number) => {
    const itemsToDecline = items.filter((item) => item.confidenceLevel === level);
    try {
      await Promise.all(itemsToDecline.map((item) => declineMutation.mutateAsync({ id: item._id })));
      toast.success(`Declined ${itemsToDecline.length} items`);
    } catch (error: any) {
      toast.error("Failed to decline some items");
    }
  };

  const handleOpenItem = (item: ReviewItem) => {
    setSelectedItem(item);
    setDrawerOpen(true);
  };

  const handleResolved = () => {
    // Item was resolved, drawer will close
  };

  const filteredItems = selectedLevel
    ? items.filter((item) => item.confidenceLevel === selectedLevel)
    : items;

  const itemsByLevel = filteredItems.reduce((acc, item) => {
    const level = item.confidenceLevel || 3;
    if (!acc[level]) acc[level] = [];
    acc[level].push(item);
    return acc;
  }, {} as Record<number, ReviewItem[]>);

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Review Inbox</h1>
        <p className="text-muted-foreground mt-2">
          Review and verify subscription candidates detected from your emails
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Confidence Level</label>
              <Select
                value={selectedLevel?.toString() || "all"}
                onValueChange={(value) =>
                  setSelectedLevel(value === "all" ? undefined : parseInt(value, 10))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="5">Level 5 - Critical</SelectItem>
                  <SelectItem value="4">Level 4 - High</SelectItem>
                  <SelectItem value="3">Level 3 - Medium</SelectItem>
                  <SelectItem value="2">Level 2 - Low</SelectItem>
                  <SelectItem value="1">Level 1 - Very Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="pt-6">
              <Button
                variant="outline"
                onClick={() => handleBulkDecline(1)}
                disabled={!itemsByLevel[1]?.length || isLoading}
              >
                Decline All Level 1-2
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredItems.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No pending review items</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(itemsByLevel)
            .sort(([a], [b]) => parseInt(b) - parseInt(a))
            .map(([level, levelItems]) => {
              const levelNum = parseInt(level, 10);
              const color = CONFIDENCE_COLORS[levelNum] || "bg-gray-500";
              const label = CONFIDENCE_LABELS[levelNum] || "Unknown";

              return (
                <Card key={level}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Badge className={`${color} text-white`}>
                          Level {level}: {label}
                        </Badge>
                        <span className="text-sm font-normal text-muted-foreground">
                          ({levelItems.length} item{levelItems.length !== 1 ? "s" : ""})
                        </span>
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-3">
                        {levelItems.map((item) => {
                          const aiExtracted = item.aiExtracted || {};
                          return (
                            <Card key={item._id} className="p-4">
                              <div className="space-y-3">
                                <div>
                                  <div className="font-semibold">{item.subject}</div>
                                  <div className="text-sm text-muted-foreground">{item.from}</div>
                                  {item.date && (
                                    <div className="text-xs text-muted-foreground">
                                      {new Date(item.date).toLocaleDateString()}
                                    </div>
                                  )}
                                </div>

                                <Separator />

                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  <div>
                                    <span className="text-muted-foreground">Service:</span>{" "}
                                    {aiExtracted.service || item.service || "Unknown"}
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Amount:</span>{" "}
                                    {item.currency || aiExtracted.currency || "USD"}{" "}
                                    {(aiExtracted.amount || item.amount || 0).toFixed(2)}
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Cycle:</span>{" "}
                                    {aiExtracted.billingCycle || "monthly"}
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Category:</span>{" "}
                                    {aiExtracted.category || item.category || "Other"}
                                  </div>
                                </div>

                                {item.cleanedPreview && (
                                  <div className="text-xs text-muted-foreground line-clamp-2">
                                    {item.cleanedPreview.substring(0, 150)}...
                                  </div>
                                )}

                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleOpenItem(item)}
                                    className="flex-1"
                                  >
                                    Review
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleVerify(item)}
                                    disabled={verifyMutation.isPending}
                                  >
                                    {verifyMutation.isPending ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <CheckCircle2 className="h-4 w-4" />
                                    )}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDecline(item)}
                                    disabled={declineMutation.isPending}
                                  >
                                    {declineMutation.isPending ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <XCircle className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </Card>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              );
            })}
        </div>
      )}

      <ReviewDrawer
        item={selectedItem}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onResolved={handleResolved}
      />
    </div>
  );
}

