import { Check } from "lucide-react";
import type { ConversionStep } from "@shared/schema";

const steps: { key: ConversionStep; label: string; sublabel: string }[] = [
  { key: "upload", label: "Upload", sublabel: "Tableau file upload" },
  { key: "extraction", label: "Extraction", sublabel: "Component analysis" },
  { key: "planning", label: "Planning", sublabel: "Conversion flow" },
  { key: "generation", label: "Generation", sublabel: "Power BI output" },
  { key: "validation", label: "Validation", sublabel: "Conversion insights" },
];

const stepOrder: ConversionStep[] = ["upload", "extraction", "planning", "generation", "validation"];

function getStepIndex(step: ConversionStep) {
  return stepOrder.indexOf(step);
}

export function StepIndicator({ currentStep }: { currentStep: ConversionStep }) {
  const currentIndex = getStepIndex(currentStep);

  return (
    <div className="flex items-center justify-center gap-0 py-6 px-4" data-testid="step-indicator">
      {steps.map((step, i) => {
        const isCompleted = i < currentIndex;
        const isCurrent = i === currentIndex;
        const isUpcoming = i > currentIndex;

        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center min-w-[100px]">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                  isCompleted
                    ? "bg-primary text-primary-foreground"
                    : isCurrent
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-muted text-muted-foreground"
                }`}
                data-testid={`step-circle-${step.key}`}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <span>{i + 1}</span>
                )}
              </div>
              <span
                className={`mt-2 text-xs font-semibold transition-colors ${
                  isCompleted || isCurrent ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
              <span
                className={`text-[10px] transition-colors ${
                  isCompleted || isCurrent ? "text-muted-foreground" : "text-muted-foreground/60"
                }`}
              >
                {step.sublabel}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`w-16 h-[2px] mx-1 mt-[-20px] transition-colors duration-300 ${
                  i < currentIndex ? "bg-primary" : "bg-muted"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
