import { z } from "zod";

export const conversionSteps = ["upload", "extraction", "planning", "generation", "validation"] as const;
export type ConversionStep = typeof conversionSteps[number];

export const datasourceSchema = z.object({
  name: z.string(),
  connection: z.string(),
  tables: z.array(z.object({
    name: z.string(),
    columns: z.array(z.object({
      name: z.string(),
      caption: z.string().optional(),
      datatype: z.string(),
      role: z.string(),
    })),
  })),
  joins: z.array(z.object({
    left: z.string(),
    right: z.string(),
    condition: z.string(),
  })),
  calculatedFields: z.array(z.object({
    name: z.string(),
    caption: z.string(),
    formula: z.string(),
    datatype: z.string(),
    role: z.string(),
  })),
});

export const worksheetSchema = z.object({
  name: z.string(),
  datasource: z.string().optional(),
  fields: z.array(z.string()).optional(),
});

export const dashboardSchema = z.object({
  name: z.string(),
  worksheets: z.array(z.string()),
});

export const parameterSchema = z.object({
  name: z.string(),
  dataType: z.string(),
  currentValue: z.string(),
  allowedValues: z.array(z.string()),
});

export const actionFilterSchema = z.object({
  name: z.string(),
  trigger: z.string(),
  source: z.string(),
  target: z.string(),
  actionType: z.string(),
});

export const extractionResultSchema = z.object({
  datasources: z.array(datasourceSchema),
  worksheets: z.array(worksheetSchema),
  dashboards: z.array(dashboardSchema),
  parameters: z.array(parameterSchema).optional(),
  filters: z.array(actionFilterSchema).optional(),
  summary: z.object({
    totalDatasources: z.number(),
    totalTables: z.number(),
    totalCalculatedFields: z.number(),
    totalColumns: z.number(),
    totalDashboards: z.number(),
    totalWorksheets: z.number(),
    totalParameters: z.number().optional(),
    totalFilters: z.number().optional(),
  }),
});

export const generatedFileSchema = z.object({
  path: z.string(),
  name: z.string(),
  content: z.string(),
  category: z.string(),
});

export const conversionResultSchema = z.object({
  files: z.array(generatedFileSchema),
  conversionPlan: z.string(),
  flowSteps: z.array(z.object({
    step: z.number(),
    name: z.string(),
    description: z.string(),
  })),
});

const validationCheckSchema = z.object({
  name: z.string(),
  status: z.enum(["passed", "warning", "failed"]),
  source: z.string(),
  target: z.string(),
  notes: z.string().optional(),
});

const dashboardValidationSchema = z.object({
  dashboardName: z.string(),
  overallScore: z.number(),
  status: z.string(),
  calculations: z.object({
    score: z.number(),
    checks: z.array(validationCheckSchema),
  }),
  formatting: z.object({
    score: z.number(),
    checks: z.array(validationCheckSchema),
  }),
  chartTypes: z.object({
    score: z.number(),
    checks: z.array(validationCheckSchema),
  }),
});

export const validationResultSchema = z.object({
  overallScore: z.number(),
  totalDashboards: z.number(),
  dashboardReports: z.array(dashboardValidationSchema),
  conversionProgress: z.object({
    totalComponents: z.number(),
    convertedComponents: z.number(),
    percentage: z.number(),
    details: z.array(z.object({
      component: z.string(),
      status: z.string(),
      source: z.string(),
      target: z.string(),
    })),
  }),
});

export type Datasource = z.infer<typeof datasourceSchema>;
export type Worksheet = z.infer<typeof worksheetSchema>;
export type Dashboard = z.infer<typeof dashboardSchema>;
export type ExtractionResult = z.infer<typeof extractionResultSchema>;
export type GeneratedFile = z.infer<typeof generatedFileSchema>;
export type ConversionResult = z.infer<typeof conversionResultSchema>;
export type ValidationResult = z.infer<typeof validationResultSchema>;

export interface User {
  id: string;
  username: string;
  password: string;
}

export interface InsertUser {
  username: string;
  password: string;
}
