import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConverter } from "@/lib/converter-context";

export function Header() {
  const { currentStep, reset } = useConverter();
  const showStartOver = currentStep !== "upload";

  return (
    <header className="border-b bg-background sticky top-0 z-50" data-testid="app-header">
      <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
            EXL
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight" data-testid="text-app-title">
              Tableau to Power BI Converter
            </h1>
            <p className="text-xs text-muted-foreground leading-tight">
              Seamlessly transform your Tableau dashboards into Power BI
            </p>
          </div>
        </div>
        {showStartOver && (
          <Button
            variant="outline"
            size="sm"
            onClick={reset}
            data-testid="button-start-over"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            Start Over
          </Button>
        )}
      </div>
    </header>
  );
}
