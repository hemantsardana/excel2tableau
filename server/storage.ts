import type { ExtractionResult, ConversionResult, ValidationResult, GeneratedFile } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  setExtractionResult(result: ExtractionResult): void;
  getExtractionResult(): ExtractionResult | null;
  setConversionResult(result: ConversionResult): void;
  getConversionResult(): ConversionResult | null;
  setValidationResult(result: ValidationResult): void;
  getValidationResult(): ValidationResult | null;
  setSqlContents(contents: Record<string, string>): void;
  getSqlContents(): Record<string, string>;
  getGeneratedFiles(): GeneratedFile[];
  reset(): void;
}

export class MemStorage implements IStorage {
  private extractionResult: ExtractionResult | null = null;
  private conversionResult: ConversionResult | null = null;
  private validationResult: ValidationResult | null = null;
  private sqlContents: Record<string, string> = {};

  setExtractionResult(result: ExtractionResult): void {
    this.extractionResult = result;
  }

  getExtractionResult(): ExtractionResult | null {
    return this.extractionResult;
  }

  setConversionResult(result: ConversionResult): void {
    this.conversionResult = result;
  }

  getConversionResult(): ConversionResult | null {
    return this.conversionResult;
  }

  setValidationResult(result: ValidationResult): void {
    this.validationResult = result;
  }

  getValidationResult(): ValidationResult | null {
    return this.validationResult;
  }

  setSqlContents(contents: Record<string, string>): void {
    this.sqlContents = contents;
  }

  getSqlContents(): Record<string, string> {
    return this.sqlContents;
  }

  getGeneratedFiles(): GeneratedFile[] {
    return this.conversionResult?.files || [];
  }

  reset(): void {
    this.extractionResult = null;
    this.conversionResult = null;
    this.validationResult = null;
    this.sqlContents = {};
  }
}

export const storage = new MemStorage();
