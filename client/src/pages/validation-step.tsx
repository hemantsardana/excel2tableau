import { ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConverter } from "@/lib/converter-context";
import { useToast } from "@/hooks/use-toast";

export default function ValidationStep() {
  const { setCurrentStep } = useConverter();
  const { toast } = useToast();

  const handleDownloadAll = async () => {
    try {
      const res = await fetch("/api/download-all");
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ddm_migrated_pbi.zip";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Error", description: "Failed to download files", variant: "destructive" });
    }
  };

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 130px)" }}>
      <div className="flex items-center justify-between gap-4 px-6 py-4 flex-shrink-0">
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-validation-title">Conversion Validation</h2>
          <p className="text-sm text-muted-foreground mt-1">Migration validation report for Dealer DM dashboard</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setCurrentStep("generation")} data-testid="button-back-generation">
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
            Back
          </Button>
          <Button onClick={handleDownloadAll} data-testid="button-download-final">
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Download All
          </Button>
        </div>
      </div>
      <div className="flex-1 px-6 pb-6 min-h-0">
        <iframe
          src="/api/validation-html"
          className="w-full h-full rounded-lg border"
          style={{ minHeight: "600px" }}
          title="Migration Validation Report"
        />
      </div>
    </div>
  );
}
