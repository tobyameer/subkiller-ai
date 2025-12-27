import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScanMode } from "@/hooks/useGmailScan";

interface ScanModeSelectorProps {
  value: ScanMode;
  onChange: (mode: ScanMode) => void;
  disabled?: boolean;
}

export function ScanModeSelector({ value, onChange, disabled }: ScanModeSelectorProps) {
  return (
    <div className="space-y-3">
      <Label className="text-sm font-semibold">Scan Mode</Label>
      <RadioGroup value={value} onValueChange={(v) => onChange(v as ScanMode)} disabled={disabled}>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="quick" id="quick" />
          <Label htmlFor="quick" className="cursor-pointer font-normal">
            <div className="font-medium">Quick Scan</div>
            <div className="text-xs text-muted-foreground">
              Recommended - Fast, finds most subscriptions
            </div>
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="deep" id="deep" />
          <Label htmlFor="deep" className="cursor-pointer font-normal">
            <div className="font-medium">Deep Scan</div>
            <div className="text-xs text-muted-foreground">
              Slower, finds more potential subscriptions
            </div>
          </Label>
        </div>
      </RadioGroup>
    </div>
  );
}

