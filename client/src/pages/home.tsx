import { StepIndicator } from "@/components/step-indicator";
import { Header } from "@/components/header";
import { useConverter } from "@/lib/converter-context";
import UploadStep from "./upload-step";
import ExtractionStep from "./extraction-step";
import PlanningStep from "./planning-step";
import GenerationStep from "./generation-step";
import ValidationStep from "./validation-step";

export default function Home() {
  const { currentStep } = useConverter();

  const renderStep = () => {
    switch (currentStep) {
      case "upload": return <UploadStep />;
      case "extraction": return <ExtractionStep />;
      case "planning": return <PlanningStep />;
      case "generation": return <GenerationStep />;
      case "validation": return <ValidationStep />;
      default: return <UploadStep />;
    }
  };

  return (
    <div className="min-h-screen bg-background" data-testid="page-home">
      <Header />
      <StepIndicator currentStep={currentStep} />
      <main className="pb-12">
        {renderStep()}
      </main>
    </div>
  );
}
