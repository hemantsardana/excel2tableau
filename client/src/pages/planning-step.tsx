import { useState, useRef, useCallback, useEffect } from "react";
import { ArrowLeft, ArrowRight, GitBranch, List, Settings, ChevronDown, ChevronRight, Layers, Search, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useConverter } from "@/lib/converter-context";
import { useToast } from "@/hooks/use-toast";

interface FlowNode {
  id: string;
  label: string;
  x: number;
  y: number;
  type: "pill" | "rect";
  tooltip: string[];
  width?: number;
}

interface FlowEdge {
  from: string;
  to: string;
  dashed?: boolean;
  label?: string;
  labelX?: number;
  labelY?: number;
  feedbackRight?: boolean;
}

const INITIAL_NODES: FlowNode[] = [
  {
    id: "sql-input",
    label: "Extract Data Files",
    x: 100,
    y: 30,
    type: "pill",
    width: 150,
    tooltip: [
      "Input data files:",
      "  Extract.csv",
      "  Extract_1.csv",
      "",
      "Source: Federated / Excel",
      "  TWG Data, Dealer Ranking",
      "  Zip_Beam_Status_Period",
    ],
  },
  {
    id: "twb-input",
    label: "Tableau Assets (.twbx)",
    x: 480,
    y: 30,
    type: "pill",
    width: 240,
    tooltip: [
      "Tableau workbook:",
      "  Dealer_DM_Dashboard_TWG_Matchback.twbx",
      "",
      "Contains:",
      "  9 Dashboards",
      "  132 Worksheets",
      "  2 Datasources",
      "  90 Calculated Fields",
      "  7 Parameters",
    ],
  },
  {
    id: "twb-extractor",
    label: "WBX/TWB Extractor",
    x: 310,
    y: 170,
    type: "rect",
    tooltip: [
      "Parses TWBX XML structure:",
      "  <datasources> → 2 datasources",
      "  <worksheets> → 132 worksheets",
      "  <dashboards> → 9 dashboards",
      "  <column> → table schemas",
      "  <calculation> → 90 calc fields",
    ],
  },
  {
    id: "normalized-json",
    label: "Normalized Tableau Semantic JSON",
    x: 430,
    y: 300,
    type: "rect",
    width: 310,
    tooltip: [
      "Normalized metadata includes:",
      "  datasources[]: federated (local)",
      "  tables[]: TWG Data, Dealer Ranking,",
      "    Extract, Data, Zip_Beam_Status",
      "  joins[]: TWG Data ↔ Dealer Ranking",
      "    Extract ↔ Dealer Ranking",
      "  calculatedFields[]: 90 total:",
      "    Cost per Call (SUM/SUM)",
      "    Resp. Rate, Yoy_Mon",
      "    Mail Type Aliased (CASE)",
      "    KPIs 1, KPIs_1K, Date Range",
      "    Monthly / Weekly View/BDN",
    ],
  },
  {
    id: "schema-analyzer",
    label: "Schema & Calc Analyzer",
    x: 310,
    y: 430,
    type: "rect",
    tooltip: [
      "Analyzes calculated fields:",
      "  Cost per Call → DIVIDE measure",
      "  Resp. Rate → DIVIDE measure",
      "  KPIs 1 → SWITCH measure",
      "  Mail Type Aliased → SWITCH col",
      "  Yoy_Mon → IF/LOD pattern",
      "  MQ_LKP, TC_LKP → IF col",
      "",
      "LOD conversions:",
      "  FIXED MAX([Est_IHD]) → ALLSELECTED",
      "  EXCLUDE pattern → ALLEXCEPT",
      "",
      "Parameters → DAX slicer measure",
    ],
  },
  {
    id: "visual-analyzer",
    label: "Visual Mapping Analyzer",
    x: 650,
    y: 430,
    type: "rect",
    tooltip: [
      "Maps Tableau visuals to PBI:",
      "  Dashboards → Report Pages:",
      "    TWG Dashboard",
      "    Matchback Dashboard 1",
      "    Matchback Dashboard 2",
      "    Overall Summary",
      "    Comparison Dashboard",
      "    (+ 4 more dashboards)",
      "",
      "  Worksheets → PBI Visuals:",
      "    Bar charts, Line charts,",
      "    Tables, KPI cards",
      "    (132 worksheets total)",
    ],
  },
  {
    id: "design-json",
    label: "Power BI Design JSON",
    x: 430,
    y: 560,
    type: "rect",
    width: 250,
    tooltip: [
      "Intermediate design model:",
      "  report.json (layout config)",
      "  pages.json (page ordering)",
      "  version.json (schema ver)",
      "  CY25SU12.json (base theme)",
      "",
      "Maps visual types:",
      "  clusteredBarChart",
      "  pieChart, donutChart",
      "  tableEx, card",
    ],
  },
  {
    id: "pq-builder",
    label: "Power Query M Builder",
    x: 310,
    y: 690,
    type: "rect",
    tooltip: [
      "Generates M expressions:",
      "  Source = Excel.Workbook(",
      "    File.Contents(\"Extract_1.csv\"))",
      "",
      "  Federated local sources:",
      "    Extract_1 → TWG Matchback tbl",
      "    Extract → Matchback data tbl",
      "    Dealer Ranking → dim table",
      "    Zip_Beam_Status_Period → dim",
    ],
  },
  {
    id: "pbip-gen",
    label: "PBIP / Tabular Gen",
    x: 650,
    y: 690,
    type: "rect",
    tooltip: [
      "Generates TMDL files:",
      "  TWG_Data.tmdl (24 columns)",
      "  Dealer_Ranking.tmdl (22 cols)",
      "  Extract_1.tmdl (6 columns)",
      "  Extract.tmdl (16 columns)",
      "  model.tmdl (refs + culture)",
      "  relationships.tmdl:",
      "    TWG Data ↔ Dealer Ranking",
      "    Extract ↔ Dealer Ranking",
      "  database.tmdl, en-US.tmdl",
      "",
      "  CalculatedFields.dax:",
      "    42 + 48 = 90 Measures/Cols",
      "    + LOD + Parameter patterns",
    ],
  },
  {
    id: "component-map",
    label: "Tableau → PBIX Component Mapping",
    x: 430,
    y: 820,
    type: "rect",
    width: 330,
    tooltip: [
      "Component mapping results:",
      "  Datasources → SemanticModel",
      "  Joins → relationships.tmdl",
      "  Calc Fields → DAX measures",
      "  Dashboards → Report pages",
      "  Worksheets → page visuals",
      "  Formatting → CY25SU12 theme",
      "  SQL queries → Power Query M",
    ],
  },
  {
    id: "artifact",
    label: "PBIP / PBIX Artifact",
    x: 430,
    y: 940,
    type: "rect",
    width: 250,
    tooltip: [
      "Generated project structure:",
      "  ddm_migrated.pbip",
      "  .Report/",
      "    definition.pbir",
      "    definition/report.json",
      "    definition/pages/ (9 pages)",
      "    definition/pages/*/visuals/",
      "    StaticResources/BaseThemes/",
      "  .SemanticModel/",
      "    definition.pbism",
      "    definition/model.bim",
      "    definition/tables/ (4 tables)",
      "    definition/relationships.tmdl",
      "    diagramLayout.json",
    ],
  },
  {
    id: "deploy",
    label: "Deployment & Validation",
    x: 430,
    y: 1060,
    type: "pill",
    width: 250,
    tooltip: [
      "Final output targets:",
      "  .pbix file for PBI Desktop",
      "  PBIP folder for PBI Service",
      "",
      "Validate dashboards:",
      "  TWG Dashboard",
      "  Matchback Dashboard 1",
      "  Matchback Dashboard 2",
      "  Overall Summary",
    ],
  },
];

const EDGES: FlowEdge[] = [
  { from: "sql-input", to: "twb-extractor" },
  { from: "twb-input", to: "twb-extractor" },
  { from: "twb-extractor", to: "normalized-json" },
  { from: "normalized-json", to: "schema-analyzer" },
  { from: "normalized-json", to: "visual-analyzer" },
  { from: "schema-analyzer", to: "design-json" },
  { from: "visual-analyzer", to: "design-json" },
  { from: "design-json", to: "pq-builder" },
  { from: "design-json", to: "pbip-gen" },
  { from: "pq-builder", to: "component-map" },
  { from: "pbip-gen", to: "component-map" },
  { from: "component-map", to: "artifact" },
  { from: "artifact", to: "deploy" },
  { from: "sql-input", to: "schema-analyzer", dashed: true, label: "SQL refs → DAX Measures" },
  { from: "sql-input", to: "pq-builder", dashed: true, label: "Pushdown SQL / Native Query" },
  { from: "component-map", to: "design-json", feedbackRight: true },
];

const NODE_H = 44;

function getNodeCenter(node: FlowNode): { x: number; y: number } {
  const w = node.width || 210;
  return { x: node.x + w / 2, y: node.y + NODE_H / 2 };
}

export default function PlanningStep() {
  const { setCurrentStep, setConversionResult, setGeneratedFiles, setIsProcessing, isProcessing, extractionResult } = useConverter();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("flow");

  const handleGenerate = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch("/api/generate", { method: "POST" });
      if (!res.ok) throw new Error("Generation failed");
      const result = await res.json();
      setConversionResult(result);
      setGeneratedFiles(result.files || []);
      setCurrentStep("generation");
    } catch {
      toast({ title: "Error", description: "Failed to generate Power BI files", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  const flowSteps = [
    {
      num: 1,
      title: "Ingestion & Parsing",
      desc: "Parse TWB XML and extract SQL queries",
      details: [
        { label: "TWBX File", value: "Dealer_DM_Dashboard_TWG_Matchback.twbx" },
        { label: "XML Elements Parsed", value: "<datasources>, <worksheets>, <dashboards>, <columns>, <calculation>" },
        { label: "Data Files Ingested", value: "Extract.csv, Extract_1.csv" },
        { label: "Data Source", value: "Federated / Local Extract (Hyper)" },
        { label: "Tables", value: "TWG Data, Dealer Ranking, Extract, Zip_Beam_Status_Period" },
      ],
    },
    {
      num: 2,
      title: "Schema & Visual Mapping",
      desc: "Analyze schema, calculated fields, and visual mappings",
      details: [
        { label: "Tables Discovered", value: "TWG Data (24 cols), Dealer Ranking (22 cols), Extract (16 cols), Zip_Beam_Status_Period (11 cols)" },
        { label: "Relationships", value: "TWG Data \u2194 Dealer Ranking (left join), Extract \u2194 Dealer Ranking (left join)" },
        { label: "Calculated Fields", value: "90 total \u2014 42 in DS1, 48 in DS2" },
        { label: "Measures", value: "Cost per Call, Resp. Rate, KPIs 1, MQ_LKP, TC_LKP, Cost per 1000 Pieces" },
        { label: "Columns", value: "Mail Type Aliased, Monthly / Weekly View, Color Code, Yoy_Mon" },
        { label: "LOD \u2192 DAX", value: "FIXED MAX([Est_IHD]) \u2192 ALLSELECTED, EXCLUDE YEAR/MONTH \u2192 ALLEXCEPT" },
        { label: "Parameters \u2192 DAX", value: "Cost Per Call Parameter, Monthly / Weekly View, KPI List \u2192 Slicer measures" },
      ],
    },
    {
      num: 3,
      title: "Model & Report Builder",
      desc: "Generate PBIP tabular model and Power Query M",
      details: [
        { label: "TMDL Files", value: "TWG_Data.tmdl, Dealer_Ranking.tmdl, Extract.tmdl, Zip_Beam_Status_Period.tmdl" },
        { label: "Model Config", value: "model.bim (culture: en-US, compatibilityLevel: 1550)" },
        { label: "Relationships", value: "TWG Data ↔ Dealer Ranking, Extract ↔ Dealer Ranking" },
        { label: "DAX Measures", value: "90 calculated fields mapped to DAX (measures + columns + LOD patterns)" },
        { label: "Power Query M", value: "Excel.Workbook() / Csv.Document() for each extract file" },
        { label: "Report Pages", value: "TWG Dashboard, Matchback Dashboard 1 & 2, Overall Summary, Comparison Dashboard, + 4 more" },
      ],
    },
    {
      num: 4,
      title: "Component Mapping",
      desc: "Map Tableau components to PBIX equivalents",
      details: [
        { label: "Datasources \u2192", value: "SemanticModel (tables + expressions)" },
        { label: "Joins \u2192", value: "relationships in model.bim" },
        { label: "Calc Fields \u2192", value: "DAX measures & calculated columns (90 total)" },
        { label: "Dashboards \u2192", value: "Report pages (9 pages)" },
        { label: "Worksheets \u2192", value: "Page visuals (132 worksheets mapped)" },
        { label: "Parameters \u2192", value: "DAX slicer measures + What-If parameters" },
        { label: "Actions \u2192", value: "Power BI cross-filter / navigation (9 actions)" },
      ],
    },
    {
      num: 5,
      title: "PBIX Aggregation",
      desc: "Assemble final Power BI artifact",
      details: [
        { label: "Project File", value: "ddm_migrated.pbip" },
        { label: "Report Folder", value: ".Report/ (definition.pbir, report.json, pages/, StaticResources/)" },
        { label: "Semantic Model", value: ".SemanticModel/ (definition.pbism, model.bim, diagramLayout.json)" },
        { label: "Output Formats", value: ".pbix (compiled), PBIP folder (for Power BI Service)" },
        { label: "Dashboards", value: "9 report pages covering TWG, Matchback, Comparison, and Summary views" },
      ],
    },
  ];

  const componentMappings = [
    { source: "Datasources (TWB XML)", target: "Data Model (tables, columns, relationships)" },
    { source: "Joins (TWB XML)", target: "Data Model (tables, columns, relationships)" },
    { source: "Fields, Types, Hierarchies (TWB XML)", target: "Data Model (tables, columns, relationships)" },
    { source: "Layout, Worksheets, Dashboards (TWB XML)", target: "Diagram State (layout of tables)" },
    { source: "Field Roles, Attributes, Metadata (TWB XML)", target: "Metadata (descriptions, formatting, roles)" },
    { source: "Worksheets & Dashboards (TWB XML)", target: "Report Layout (pages, visuals, containers)" },
    { source: "Field Captions, Semantic Hints (TWB XML)", target: "Linguistic Schema (semantic roles, naming)" },
    { source: "Calculated Fields (TWB: row, table, LOD)", target: "DAX (Measures, Calculated Columns)" },
  ];

  const conversionPlan = `TABLEAU → POWER BI CONVERSION PLAN
=====================================

Generated: ${new Date().toISOString()}

OVERVIEW
--------

PIPELINE FLOW (HIGH LEVEL)
--------------------------
1. Ingest TWB XML
2. Extract semantic metadata → normalized JSON (datasources, tables, joins, worksheets, dashboards, calculated fields)
3. Analyze project SQL → discover physical tables + transformation logic
4. Map Tableau data model to Power BI tabular model
5. Convert calculated fields to DAX measures
6. Build Power Query M expressions from SQL sources
7. Generate Report Layout (pages, visuals, containers)
8. Map worksheet chart types to Power BI visual types
9. Generate Data Model with relationships
10. Create Diagram Layout
11. Assemble PBIP / PBIX artifact structure
12. Quality Review and readiness checks

INPUTS & PRIMARY OUTPUTS
------------------------
Input Sources:
  - TWB XML workbook
  - Extracted SQL files (staging, transformation, final)
  - Tableau calculated field formulas

Generated Power BI Artifacts:
  - DataModel (tabular model)
  - Report/definition/report.json
  - Report/definition/pages/*.json
  - Report/definition/pages/*/visuals/*.json
  - DiagramLayout
  - [Content_Types].xml
  - Settings
  - Metadata
  - Version
  - SecurityBindings`;

  const requirements = extractionResult ? `
CONVERSION REQUIREMENTS
=======================

Source Analysis:
  - Datasources: ${extractionResult.summary.totalDatasources}
  - Tables: ${extractionResult.summary.totalTables}
  - Calculated Fields: ${extractionResult.summary.totalCalculatedFields}
  - Columns: ${extractionResult.summary.totalColumns}
  - Dashboards: ${extractionResult.summary.totalDashboards}
  - Worksheets: ${extractionResult.summary.totalWorksheets}

Target Requirements:
  - Power BI Data Model with all tables and relationships
  - DAX measures for all calculated fields
  - Report pages for each dashboard
  - Visual configurations for each worksheet
  - Power Query M expressions for data sources
  - Proper metadata and semantic model
` : "";

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-planning-title">Conversion Planning</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Visualize the transformation from Tableau to Power BI
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setCurrentStep("extraction")} data-testid="button-back-extraction">
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
            Back
          </Button>
          <Button onClick={handleGenerate} disabled={isProcessing} data-testid="button-next-generation">
            {isProcessing ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                Generating...
              </span>
            ) : (
              <>
                Generate Power BI
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </>
            )}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4" data-testid="planning-tabs">
          <TabsTrigger value="flow" data-testid="tab-flow">
            <GitBranch className="w-3.5 h-3.5 mr-1.5" />
            Visual Flow Diagram
          </TabsTrigger>
          <TabsTrigger value="steps" data-testid="tab-steps">
            <List className="w-3.5 h-3.5 mr-1.5" />
            Flowchart Steps
          </TabsTrigger>
          <TabsTrigger value="calc-levels" data-testid="tab-calc-levels">
            <Layers className="w-3.5 h-3.5 mr-1.5" />
            Calc Field Levels
          </TabsTrigger>
          <TabsTrigger value="lineage" data-testid="tab-lineage">
            <Network className="w-3.5 h-3.5 mr-1.5" />
            Data Lineage
          </TabsTrigger>
        </TabsList>

        <TabsContent value="flow">
          <Card className="p-6" data-testid="card-flow-diagram">
            <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
              <h3 className="font-bold text-base">Conversion Flow Diagram</h3>
              <p className="text-[10px] text-muted-foreground italic">Drag nodes to rearrange. Hover for details.</p>
            </div>
            <p className="text-xs text-muted-foreground mb-6">
              Interactive visualization of the Tableau to Power BI transformation pipeline
            </p>
            <InteractiveFlowDiagram />
          </Card>
        </TabsContent>

        <TabsContent value="steps">
          <Card className="p-6" data-testid="card-flowchart-steps">
            <h3 className="font-bold text-base mb-1">Pipeline Steps</h3>
            <p className="text-xs text-muted-foreground mb-4">Click a step to see project-specific details</p>
            <div className="space-y-2">
              {flowSteps.map((step) => {
                const isOpen = expandedStep === step.num;
                return (
                  <div key={step.num} className="border rounded-md overflow-visible" data-testid={`pipeline-step-${step.num}`}>
                    <button
                      type="button"
                      className="w-full flex gap-3 items-center p-3 text-left hover-elevate rounded-md"
                      onClick={() => setExpandedStep(isOpen ? null : step.num)}
                      data-testid={`button-pipeline-step-${step.num}`}
                    >
                      <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {step.num}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{step.title}</p>
                        <p className="text-xs text-muted-foreground">{step.desc}</p>
                      </div>
                      {isOpen ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      )}
                    </button>
                    {isOpen && (
                      <div className="px-3 pb-3 pt-0 ml-11" data-testid={`pipeline-step-details-${step.num}`}>
                        <div className="border-t pt-3 space-y-2">
                          {step.details.map((d, i) => (
                            <div key={i} className="flex gap-2 text-xs">
                              <span className="font-semibold text-muted-foreground whitespace-nowrap min-w-[130px]">{d.label}</span>
                              <span>{d.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-8">
              <h4 className="font-bold text-sm mb-3">Component Mapping Table</h4>
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted">
                      <th className="text-left p-2 font-semibold">Tableau Source</th>
                      <th className="text-left p-2 font-semibold">Generated PBIX Component</th>
                    </tr>
                  </thead>
                  <tbody>
                    {componentMappings.map((m, i) => (
                      <tr key={i} className={i % 2 === 0 ? "" : "bg-muted/30"}>
                        <td className="p-2">{m.source}</td>
                        <td className="p-2">{m.target}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="calc-levels">
          <CalcFieldLevelsTab />
        </TabsContent>

        <TabsContent value="lineage">
          <LineageTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Data Lineage Tab ──────────────────────────────────────────────────────

function LineageTab() {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="space-y-3">
      {/* Header card */}
      <Card className="px-5 py-4 border-2 border-orange-200 bg-orange-50/60">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-orange-500 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Network className="w-4.5 h-4.5 text-white w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-gray-900 leading-tight">Data Lineage Journey</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Trace how each measure or calculated field flows from raw columns through transformations.
                Select a field from the dropdowns to visualize its full dependency path.
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0 flex-wrap text-[11px]">
            {[
              { color: "bg-emerald-500", label: "Source / Base Column" },
              { color: "bg-blue-500",    label: "Transformation Step" },
              { color: "bg-amber-400",   label: "Selected Field" },
              { color: "bg-red-500",     label: "Downstream Consumer" },
            ].map((l) => (
              <span key={l.label} className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-2.5 py-1 font-medium text-gray-600">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${l.color}`} />
                {l.label}
              </span>
            ))}
          </div>
        </div>
      </Card>

      {/* iframe wrapper */}
      <div className="relative rounded-xl overflow-hidden border border-gray-200 shadow-sm bg-white">
        {!loaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 bg-white">
            <Network className="w-8 h-8 text-orange-400 animate-pulse" />
            <span className="text-sm text-gray-400">Loading lineage map…</span>
          </div>
        )}
        <iframe
          src="/api/lineage-html"
          title="Data Lineage Journey"
          className="w-full border-0 block"
          style={{ height: "680px" }}
          onLoad={() => setLoaded(true)}
        />
      </div>
    </div>
  );
}

// ─── Calc Field Levels Tab ─────────────────────────────────────────────────

type CalcField = { name: string; caption: string | null; calculation: string };
type CalcLevelsData = { levels: CalcField[][] };

const LEVEL_META = [
  {
    label: "Level 1",
    sublabel: "Base Fields",
    desc: "No dependencies on other calculated fields — build first",
    color: "bg-orange-100 text-orange-800 border-orange-300",
    barColor: "bg-orange-500",
    borderColor: "border-orange-300",
    headerBg: "bg-orange-50",
  },
  {
    label: "Level 2",
    sublabel: "Secondary Fields",
    desc: "Depend on Level 1 calculated fields",
    color: "bg-amber-100 text-amber-800 border-amber-300",
    barColor: "bg-amber-500",
    borderColor: "border-amber-300",
    headerBg: "bg-amber-50",
  },
  {
    label: "Level 3",
    sublabel: "Deep Dependencies",
    desc: "Depend on Level 1 & Level 2 fields — build last",
    color: "bg-red-100 text-red-800 border-red-300",
    barColor: "bg-red-400",
    borderColor: "border-red-300",
    headerBg: "bg-red-50",
  },
];

function CalcFieldLevelsTab() {
  const [data, setData] = useState<CalcLevelsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [openLevel, setOpenLevel] = useState<number>(0);
  const [search, setSearch] = useState("");
  const [expandedField, setExpandedField] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/calc-field-levels")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  const totalFields = data ? data.levels.reduce((s, l) => s + l.length, 0) : 0;

  const filteredLevels = data
    ? data.levels.map((fields) =>
        fields.filter(
          (f) =>
            search === "" ||
            f.name.toLowerCase().includes(search.toLowerCase()) ||
            (f.caption ?? "").toLowerCase().includes(search.toLowerCase())
        )
      )
    : [];

  const hasSearchResults = filteredLevels.some((l) => l.length > 0);

  if (loading) {
    return (
      <Card className="p-10 flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <Layers className="w-8 h-8 animate-pulse text-orange-400" />
        <span className="text-sm">Loading calculated field levels…</span>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="p-8 flex flex-col items-center justify-center gap-2 text-destructive">
        <span className="text-sm font-medium">Could not load dependency data.</span>
        <span className="text-xs text-muted-foreground">Run the extraction step to generate the report.</span>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary header */}
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="font-bold text-base flex items-center gap-2">
              <Layers className="w-4 h-4 text-orange-500" />
              Calculated Field Dependency Levels
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Fields are grouped by their dependency depth. Build lower levels first.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs bg-orange-50 border border-orange-200 text-orange-800 rounded-full px-3 py-1 font-medium">
              {data.levels.length} levels
            </span>
            <span className="text-xs bg-orange-50 border border-orange-200 text-orange-800 rounded-full px-3 py-1 font-medium">
              {totalFields} fields total
            </span>
          </div>
        </div>

        {/* Dependency chain visual */}
        <div className="mt-5 flex items-center gap-0 overflow-x-auto pb-1">
          {data.levels.map((fields, i) => {
            const meta = LEVEL_META[i] ?? LEVEL_META[LEVEL_META.length - 1];
            const pct = Math.round((fields.length / totalFields) * 100);
            return (
              <div key={i} className="flex items-center gap-0">
                <button
                  onClick={() => setOpenLevel(openLevel === i ? -1 : i)}
                  className={`flex flex-col items-center px-5 py-3 rounded-lg border-2 min-w-[110px] transition-all hover:shadow-md ${meta.borderColor} ${openLevel === i ? meta.headerBg + " shadow-md" : "bg-white"}`}
                >
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${meta.color} mb-1.5`}>
                    {meta.label}
                  </span>
                  <span className="text-2xl font-extrabold text-gray-800">{fields.length}</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">{meta.sublabel}</span>
                  <div className="w-full mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className={`h-full rounded-full ${meta.barColor}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-1">{pct}% of total</span>
                </button>
                {i < data.levels.length - 1 && (
                  <div className="flex items-center mx-1">
                    <div className="h-px w-5 bg-gray-300" />
                    <svg width="10" height="10" viewBox="0 0 10 10" className="text-gray-400 fill-current">
                      <polygon points="0,0 10,5 0,10" />
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
          <div className="ml-4 hidden sm:flex flex-col justify-center text-[11px] text-muted-foreground leading-relaxed max-w-[180px]">
            <span className="font-semibold text-gray-600 mb-1">Build order →</span>
            <span>Start with Level 1 base fields, then Level 2, and finally Level 3 deep fields.</span>
          </div>
        </div>
      </Card>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search fields by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-8 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-gray-700 text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {search && !hasSearchResults && (
        <p className="text-sm text-muted-foreground text-center py-4">No fields match "{search}"</p>
      )}

      {/* Level sections */}
      {filteredLevels.map((fields, i) => {
        if (search && fields.length === 0) return null;
        const meta = LEVEL_META[i] ?? LEVEL_META[LEVEL_META.length - 1];
        const isOpen = search ? true : openLevel === i;

        return (
          <Card key={i} className={`overflow-hidden border-2 transition-all ${meta.borderColor}`}>
            {/* Level header */}
            <button
              onClick={() => setOpenLevel(isOpen && !search ? -1 : i)}
              className={`w-full flex items-center justify-between px-5 py-3.5 ${meta.headerBg} hover:brightness-95 transition-all`}
            >
              <div className="flex items-center gap-3">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${meta.color}`}>
                  {meta.label}
                </span>
                <div className="text-left">
                  <span className="text-sm font-semibold text-gray-800">{meta.sublabel}</span>
                  <span className="text-xs text-muted-foreground ml-2">— {meta.desc}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-gray-700">
                  {fields.length} field{fields.length !== 1 ? "s" : ""}
                  {search && fields.length !== data.levels[i].length && (
                    <span className="text-xs font-normal text-muted-foreground ml-1">
                      (of {data.levels[i].length})
                    </span>
                  )}
                </span>
                <span className="text-muted-foreground text-lg leading-none">{isOpen ? "▲" : "▼"}</span>
              </div>
            </button>

            {/* Fields table */}
            {isOpen && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-2.5 font-semibold text-gray-600 w-8">#</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-gray-600 w-52">Field Name</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Calculation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((field, fi) => {
                      const key = `${i}-${field.name}`;
                      const isExpanded = expandedField === key;
                      const calc = field.calculation ?? "";
                      const isLong = calc.length > 120;
                      return (
                        <tr
                          key={fi}
                          className={`border-b border-gray-100 transition-colors ${fi % 2 === 0 ? "bg-white" : "bg-gray-50/60"}`}
                        >
                          <td className="px-4 py-2.5 text-muted-foreground tabular-nums">{fi + 1}</td>
                          <td className="px-4 py-2.5">
                            <div className="font-medium text-gray-800 leading-snug">{field.caption || field.name}</div>
                            {field.caption && field.caption !== field.name && (
                              <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">{field.name}</div>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <pre
                              className={`font-mono text-[11px] text-gray-700 whitespace-pre-wrap leading-relaxed ${!isExpanded && isLong ? "line-clamp-2" : ""}`}
                            >
                              {calc}
                            </pre>
                            {isLong && (
                              <button
                                onClick={() => setExpandedField(isExpanded ? null : key)}
                                className="text-[10px] text-orange-600 hover:text-orange-800 mt-1 font-medium"
                              >
                                {isExpanded ? "Show less ▲" : "Show more ▼"}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function InteractiveFlowDiagram() {
  const [nodes, setNodes] = useState<FlowNode[]>(INITIAL_NODES);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    const node = nodes.find(n => n.id === nodeId);
    if (!node || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const svgW = containerRef.current.scrollWidth;
    const scale = svgW > 0 ? 960 / rect.width : 1;
    setDraggingNode(nodeId);
    setDragOffset({
      x: (e.clientX - rect.left) * scale - node.x,
      y: (e.clientY - rect.top + containerRef.current.scrollTop) * scale - node.y,
    });
  }, [nodes]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggingNode || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scale = 960 / rect.width;
    const newX = Math.max(0, Math.min(750, (e.clientX - rect.left) * scale - dragOffset.x));
    const newY = Math.max(0, (e.clientY - rect.top + containerRef.current.scrollTop) * scale - dragOffset.y);
    setNodes(prev => prev.map(n => n.id === draggingNode ? { ...n, x: newX, y: newY } : n));
  }, [draggingNode, dragOffset]);

  const handleMouseUp = useCallback(() => {
    setDraggingNode(null);
  }, []);

  useEffect(() => {
    const handleGlobalUp = () => setDraggingNode(null);
    window.addEventListener("mouseup", handleGlobalUp);
    return () => window.removeEventListener("mouseup", handleGlobalUp);
  }, []);

  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  const renderEdge = (edge: FlowEdge, i: number) => {
    const fromNode = nodeMap.get(edge.from);
    const toNode = nodeMap.get(edge.to);
    if (!fromNode || !toNode) return null;

    const fromC = getNodeCenter(fromNode);
    const toC = getNodeCenter(toNode);

    if (edge.feedbackRight) {
      const fromRight = fromNode.x + (fromNode.width || 210);
      const toRight = toNode.x + (toNode.width || 210);
      const farX = Math.max(fromRight, toRight) + 40;
      const path = `M ${fromRight} ${fromC.y} L ${farX} ${fromC.y} L ${farX} ${toC.y} L ${toRight} ${toC.y}`;
      return (
        <g key={`edge-${i}`}>
          <path d={path} stroke="#4a9bb5" strokeWidth="1.3" fill="none" strokeDasharray="4 3" opacity="0.7" markerEnd="url(#arr-solid)" />
          <text x={farX + 4} y={(fromC.y + toC.y) / 2} fill="#4a9bb5" fontSize="9" fontStyle="italic" opacity="0.7" writingMode="tb">feedback</text>
        </g>
      );
    }

    if (edge.dashed) {
      const fromBottom = fromNode.y + NODE_H;
      const toLeft = toNode.x;
      const midY = toNode.y + NODE_H / 2;
      const path = `M ${fromC.x} ${fromBottom} L ${fromC.x} ${midY} L ${toLeft} ${midY}`;
      return (
        <g key={`edge-${i}`}>
          <path d={path} stroke="#f07d2e" strokeWidth="1.5" strokeDasharray="6 3" fill="none" markerEnd="url(#arr-dashed)" />
          {edge.label && (
            <text x={fromC.x + 8} y={midY - 10} fill="#f07d2e" fontSize="9" fontWeight="600" fontStyle="italic">
              {edge.label}
            </text>
          )}
        </g>
      );
    }

    const fromBottom = fromNode.y + NODE_H;
    const toTop = toNode.y;
    const my = (fromBottom + toTop) / 2;
    const path = `M ${fromC.x} ${fromBottom} C ${fromC.x} ${my}, ${toC.x} ${my}, ${toC.x} ${toTop}`;
    return (
      <g key={`edge-${i}`}>
        <path d={path} stroke="#4a9bb5" strokeWidth="1.5" fill="none" markerEnd="url(#arr-solid)" />
      </g>
    );
  };

  const renderNode = (node: FlowNode) => {
    const w = node.width || 210;
    const isHovered = hoveredNode === node.id;
    const isDragging = draggingNode === node.id;

    return (
      <g
        key={node.id}
        onMouseDown={(e) => handleMouseDown(e, node.id)}
        onMouseEnter={() => setHoveredNode(node.id)}
        onMouseLeave={() => setHoveredNode(null)}
        style={{ cursor: isDragging ? "grabbing" : "grab" }}
        data-testid={`flow-node-${node.id}`}
      >
        {node.type === "pill" ? (
          <>
            <rect
              x={node.x}
              y={node.y}
              width={w}
              height={NODE_H}
              rx={NODE_H / 2}
              fill="#f07d2e"
              stroke={isHovered ? "#c45e1a" : "none"}
              strokeWidth={isHovered ? 2 : 0}
              filter={isDragging ? "url(#drop-shadow)" : undefined}
            />
            <text x={node.x + w / 2} y={node.y + 27} textAnchor="middle" fill="white" fontWeight="bold" fontSize="13" pointerEvents="none">
              {node.label}
            </text>
          </>
        ) : (
          <>
            <rect
              x={node.x}
              y={node.y}
              width={w}
              height={NODE_H}
              rx={6}
              fill={isHovered ? "#f8f9fa" : "white"}
              stroke={isHovered ? "#f07d2e" : "#b0cdd6"}
              strokeWidth={isHovered ? 2 : 1.5}
              filter={isDragging ? "url(#drop-shadow)" : undefined}
            />
            <text x={node.x + w / 2} y={node.y + 27} textAnchor="middle" fill="#333" fontWeight="600" fontSize="12" pointerEvents="none">
              {node.label}
            </text>
          </>
        )}
      </g>
    );
  };

  const renderTooltip = () => {
    if (!hoveredNode || draggingNode) return null;
    const node = nodeMap.get(hoveredNode);
    if (!node) return null;
    const w = node.width || 210;
    const tipX = node.x + w + 12;
    const tipY = node.y;
    const lines = node.tooltip;
    const maxLineLen = Math.max(...lines.map(l => l.length));
    const tipW = Math.max(180, maxLineLen * 6.5 + 20);
    const tipH = lines.length * 16 + 20;
    const adjustedX = tipX + tipW > 960 ? node.x - tipW - 12 : tipX;
    const adjustedY = tipY + tipH > 1140 ? 1140 - tipH - 5 : tipY;

    return (
      <g pointerEvents="none">
        <rect x={adjustedX} y={adjustedY} width={tipW} height={tipH} rx={6} fill="#1a1a2e" fillOpacity="0.95" />
        <polygon
          points={
            tipX + tipW > 960
              ? `${adjustedX + tipW} ${adjustedY + 14}, ${adjustedX + tipW + 6} ${adjustedY + 20}, ${adjustedX + tipW} ${adjustedY + 26}`
              : `${adjustedX} ${adjustedY + 14}, ${adjustedX - 6} ${adjustedY + 20}, ${adjustedX} ${adjustedY + 26}`
          }
          fill="#1a1a2e"
          fillOpacity="0.95"
        />
        {lines.map((line, i) => (
          <text
            key={i}
            x={adjustedX + 10}
            y={adjustedY + 18 + i * 16}
            fill={line.startsWith("  ") ? "#a0c4ff" : "#f0f0f0"}
            fontSize="10.5"
            fontFamily="monospace"
            fontWeight={line.startsWith("  ") ? "normal" : "600"}
          >
            {line}
          </text>
        ))}
      </g>
    );
  };

  const sectionLabels = [
    { num: 1, y: 90, lines: ["Ingestion &", "Parsing"] },
    { num: 2, y: 400, lines: ["Schema & Visual", "Mapping"] },
    { num: 3, y: 660, lines: ["Model & Report", "Builder"] },
    { num: 4, y: 790, lines: ["Component", "Mapping"] },
    { num: 5, y: 910, lines: ["PBIX", "Aggregation"] },
  ];

  return (
    <div
      ref={containerRef}
      className="relative overflow-x-auto select-none"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      data-testid="flow-diagram-container"
    >
      <svg viewBox="0 0 960 1140" className="w-full max-w-[960px] mx-auto" style={{ minWidth: 680 }}>
        <defs>
          <marker id="arr-solid" viewBox="0 0 10 7" refX="10" refY="3.5" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
            <polygon points="0 0, 10 3.5, 0 7" fill="#4a9bb5" />
          </marker>
          <marker id="arr-dashed" viewBox="0 0 10 7" refX="10" refY="3.5" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
            <polygon points="0 0, 10 3.5, 0 7" fill="#f07d2e" />
          </marker>
          <filter id="drop-shadow" x="-10%" y="-10%" width="130%" height="130%">
            <feDropShadow dx="2" dy="3" stdDeviation="3" floodColor="#000" floodOpacity="0.25" />
          </filter>
        </defs>

        {sectionLabels.map(({ num, y, lines }) => {
          const h = 36;
          const w = 150;
          return (
            <g key={num}>
              <rect x={8} y={y} width={w} height={h} rx={h / 2} fill="#f07d2e" opacity="0.12" />
              <circle cx={22} cy={y + 18} r={9} fill="#f07d2e" />
              <text x={22} y={y + 22} textAnchor="middle" fill="white" fontWeight="bold" fontSize="10">{num}</text>
              <text x={36} y={y + 14} fill="#f07d2e" fontWeight="600" fontSize="10">{lines[0]}</text>
              <text x={36} y={y + 28} fill="#f07d2e" fontWeight="600" fontSize="10">{lines[1]}</text>
            </g>
          );
        })}

        {EDGES.map((edge, i) => renderEdge(edge, i))}

        {nodes.map(renderNode)}

        {renderTooltip()}
      </svg>
    </div>
  );
}
