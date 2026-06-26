import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { ConversionStep, ExtractionResult, ConversionResult, ValidationResult, GeneratedFile } from "@shared/schema";

interface DatabaseConfig {
  provider: string;
  project: string;
  datasets: string[];
  tables: Record<string, string[]>;
}

interface ConverterState {
  currentStep: ConversionStep;
  twbFile: File | null;
  twbFileName: string;
  sqlFiles: File[];
  projectName: string;
  databaseConfig: DatabaseConfig | null;
  extractionResult: ExtractionResult | null;
  conversionResult: ConversionResult | null;
  validationResult: ValidationResult | null;
  generatedFiles: GeneratedFile[];
  isProcessing: boolean;
}

interface ConverterContextType extends ConverterState {
  setCurrentStep: (step: ConversionStep) => void;
  setTwbFile: (file: File | null) => void;
  setSqlFiles: (files: File[]) => void;
  setDatabaseConfig: (config: DatabaseConfig | null) => void;
  setExtractionResult: (result: ExtractionResult | null) => void;
  setConversionResult: (result: ConversionResult | null) => void;
  setValidationResult: (result: ValidationResult | null) => void;
  setGeneratedFiles: (files: GeneratedFile[]) => void;
  setIsProcessing: (processing: boolean) => void;
  reset: () => void;
}

const initialState: ConverterState = {
  currentStep: "upload",
  twbFile: null,
  twbFileName: "",
  sqlFiles: [],
  projectName: "",
  databaseConfig: null,
  extractionResult: null,
  conversionResult: null,
  validationResult: null,
  generatedFiles: [],
  isProcessing: false,
};

const ConverterContext = createContext<ConverterContextType | undefined>(undefined);

export function ConverterProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConverterState>(initialState);

  const setCurrentStep = useCallback((step: ConversionStep) => {
    setState(s => ({ ...s, currentStep: step }));
  }, []);

  const setTwbFile = useCallback((file: File | null) => {
    const fileName = file?.name || "";
    const projectName = fileName.replace(/\.(twb|twbx)$/i, "").replace(/[_-]/g, " ");
    setState(s => ({ ...s, twbFile: file, twbFileName: fileName, projectName }));
  }, []);

  const setSqlFiles = useCallback((files: File[]) => {
    setState(s => ({ ...s, sqlFiles: files }));
  }, []);

  const setDatabaseConfig = useCallback((config: DatabaseConfig | null) => {
    setState(s => ({ ...s, databaseConfig: config }));
  }, []);

  const setExtractionResult = useCallback((result: ExtractionResult | null) => {
    setState(s => ({ ...s, extractionResult: result }));
  }, []);

  const setConversionResult = useCallback((result: ConversionResult | null) => {
    setState(s => ({ ...s, conversionResult: result }));
  }, []);

  const setValidationResult = useCallback((result: ValidationResult | null) => {
    setState(s => ({ ...s, validationResult: result }));
  }, []);

  const setGeneratedFiles = useCallback((files: GeneratedFile[]) => {
    setState(s => ({ ...s, generatedFiles: files }));
  }, []);

  const setIsProcessing = useCallback((processing: boolean) => {
    setState(s => ({ ...s, isProcessing: processing }));
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  return (
    <ConverterContext.Provider value={{
      ...state,
      setCurrentStep,
      setTwbFile,
      setSqlFiles,
      setDatabaseConfig,
      setExtractionResult,
      setConversionResult,
      setValidationResult,
      setGeneratedFiles,
      setIsProcessing,
      reset,
    }}>
      {children}
    </ConverterContext.Provider>
  );
}

export function useConverter() {
  const context = useContext(ConverterContext);
  if (!context) throw new Error("useConverter must be used within ConverterProvider");
  return context;
}
