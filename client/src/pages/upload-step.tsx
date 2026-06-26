import { useCallback, useRef, useState } from "react";
import { Upload, CheckCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useConverter } from "@/lib/converter-context";
import { useToast } from "@/hooks/use-toast";

export default function UploadStep() {
  const {
    twbFile,
    twbFileName,
    projectName,
    setTwbFile,
    setCurrentStep,
    setExtractionResult,
    setIsProcessing,
    isProcessing,
  } = useConverter();
  const { toast } = useToast();
  const twbInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleTwbDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && /\.twbx$/i.test(file.name)) {
      setTwbFile(file);
    } else {
      toast({ title: "Invalid file", description: "Please upload a .twbx file", variant: "destructive" });
    }
  }, [setTwbFile, toast]);

  const handleTwbSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setTwbFile(file);
  }, [setTwbFile]);

  const handleProceed = useCallback(async () => {
    if (!twbFile) return;
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append("twbFile", twbFile);

      const res = await fetch("/api/extract", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Extraction failed");
      const result = await res.json();
      setExtractionResult(result);
      setCurrentStep("extraction");
    } catch (err) {
      toast({ title: "Error", description: "Failed to process files. Please try again.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  }, [twbFile, setExtractionResult, setCurrentStep, setIsProcessing, toast]);

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold" data-testid="text-upload-title">Upload Tableau Dashboard</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Start by uploading your Tableau workbook file to begin the conversion
        </p>
      </div>

      {!twbFile ? (
        <Card
          className={`p-10 border-2 border-dashed transition-colors cursor-pointer ${
            isDragging ? "border-primary bg-primary/5" : "border-muted"
          }`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleTwbDrop}
          onClick={() => twbInputRef.current?.click()}
          data-testid="drop-zone-twb"
        >
          <div className="flex flex-col items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Upload className="w-6 h-6 text-primary" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-sm">Upload Tableau File</p>
              <p className="text-xs text-muted-foreground mt-1">
                Drag and drop your .twbx file, or click to browse
              </p>
            </div>
            <Button variant="default" size="sm" data-testid="button-browse-twb">
              Browse Files
            </Button>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">.twbx</Badge>
            </div>
          </div>
          <input
            ref={twbInputRef}
            type="file"
            accept=".twbx"
            className="hidden"
            onChange={handleTwbSelect}
            data-testid="input-twb-file"
          />
        </Card>
      ) : (
        <div className="space-y-4">
          <Card className="p-5" data-testid="card-twb-uploaded">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm" data-testid="text-twb-success">Tableau File Uploaded Successfully</p>
                <p className="text-xs text-muted-foreground truncate">{twbFileName}</p>
                <p className="text-xs text-muted-foreground">Project: {projectName}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => { e.stopPropagation(); setTwbFile(null); }}
                data-testid="button-remove-twb"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </Card>

          <Button
            className="w-full mt-3"
            onClick={handleProceed}
            disabled={isProcessing}
            data-testid="button-proceed-extraction"
          >
            {isProcessing ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                Processing...
              </span>
            ) : (
              "Proceed to Extraction"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
