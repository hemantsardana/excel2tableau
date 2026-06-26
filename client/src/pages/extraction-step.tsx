import { useState } from "react";
import { Database, LayoutDashboard, ArrowRight, Download, Table2, Columns3, Calculator, SlidersHorizontal, Filter, ChevronDown, ChevronRight, GitMerge, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useConverter } from "@/lib/converter-context";

export default function ExtractionStep() {
  const { extractionResult, setCurrentStep, twbFileName } = useConverter();
  const [expandedDs, setExpandedDs] = useState<number[]>([0]);
  const [expandedParam, setExpandedParam] = useState<number[]>([]);

  if (!extractionResult) return null;

  const { summary, datasources, dashboards, worksheets, parameters = [], filters = [] } = extractionResult;

  const toggleDs = (i: number) =>
    setExpandedDs(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);
  const toggleParam = (i: number) =>
    setExpandedParam(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);

  const statCards = [
    { label: "Datasources", value: summary.totalDatasources, icon: Database },
    { label: "Tables", value: summary.totalTables, icon: Table2 },
    { label: "Calc. Fields", value: summary.totalCalculatedFields, icon: Calculator },
    { label: "Dashboards", value: summary.totalDashboards, icon: LayoutDashboard },
    { label: "Worksheets", value: summary.totalWorksheets, icon: FileText },
    { label: "Parameters", value: summary.totalParameters ?? parameters.length, icon: SlidersHorizontal },
    { label: "Filters", value: summary.totalFilters ?? filters.length, icon: Filter },
  ];

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-extraction-title">Component Analysis</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Detailed extraction from <span className="font-medium">{twbFileName || "Dealer_DM_Dashboard_TWG_Matchback.twbx"}</span>
          </p>
        </div>
        <Button onClick={() => setCurrentStep("planning")} data-testid="button-next-planning">
          Next: Planning
          <ArrowRight className="w-4 h-4 ml-1.5" />
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3 mb-6" data-testid="stats-grid">
        {statCards.map((stat) => (
          <Card key={stat.label} className="p-3 text-center" data-testid={`stat-${stat.label.toLowerCase().replace(/[\s.]/g, '-')}`}>
            <p className="text-xl font-bold text-primary">{stat.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</p>
          </Card>
        ))}
      </div>

      <div className="space-y-6">
        {/* Datasources */}
        <section data-testid="section-datasources">
          <div className="flex items-center gap-2 mb-3">
            <Database className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-base">Datasources</h3>
            <Badge variant="secondary">{datasources.length}</Badge>
          </div>
          {datasources.map((ds, i) => {
            const isExpanded = expandedDs.includes(i);
            return (
              <Card key={i} className="mb-3 overflow-hidden" data-testid={`datasource-${i}`}>
                <button
                  className="w-full p-4 text-left flex items-start justify-between gap-4 hover:bg-muted/30 transition-colors"
                  onClick={() => toggleDs(i)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{ds.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Connection: {ds.connection}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
                    <span>{ds.tables.length} tables</span>
                    <span>{ds.joins.length} joins</span>
                    <span>{ds.calculatedFields.length} calc. fields</span>
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </div>
                </button>
                {isExpanded && (
                  <div className="border-t px-4 pb-4 pt-3 space-y-4">
                    {/* Tables */}
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Table2 className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-xs font-semibold">Tables ({ds.tables.length})</span>
                      </div>
                      <div className="space-y-2">
                        {ds.tables.map((t, ti) => (
                          <div key={ti} className="pl-4 border-l-2 border-muted">
                            <p className="text-xs font-medium">{t.name}</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {t.columns.slice(0, 8).map((c, ci) => (
                                <Badge key={ci} variant="outline" className="text-[10px] py-0 h-5">
                                  {c.name}
                                  <span className="ml-1 text-muted-foreground">{c.datatype}</span>
                                </Badge>
                              ))}
                              {t.columns.length > 8 && (
                                <Badge variant="secondary" className="text-[10px] py-0 h-5">
                                  +{t.columns.length - 8} more
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Joins */}
                    {ds.joins.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <GitMerge className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-xs font-semibold">Joins ({ds.joins.length})</span>
                        </div>
                        {ds.joins.map((j, ji) => (
                          <div key={ji} className="flex items-center gap-2 text-xs text-muted-foreground pl-4 mb-1">
                            <span className="font-medium text-foreground">{j.left}</span>
                            <Badge variant="outline" className="text-[10px] py-0 h-4">{j.condition}</Badge>
                            <span className="font-medium text-foreground">{j.right}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Calculated Fields */}
                    {ds.calculatedFields.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <Calculator className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-xs font-semibold">Calculated Fields ({ds.calculatedFields.length})</span>
                        </div>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                          {ds.calculatedFields.map((cf, cfi) => (
                            <div key={cfi} className="pl-4 border-l-2 border-muted">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-medium">{cf.caption || cf.name}</span>
                                <Badge variant="secondary" className="text-[10px] py-0 h-4">{cf.role}</Badge>
                                <Badge variant="outline" className="text-[10px] py-0 h-4">{cf.datatype}</Badge>
                              </div>
                              {cf.formula && (
                                <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate max-w-xs" title={cf.formula}>
                                  {cf.formula}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </section>

        {/* Dashboards */}
        <section data-testid="section-dashboards">
          <div className="flex items-center gap-2 mb-3">
            <LayoutDashboard className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-base">Dashboards</h3>
            <Badge variant="secondary">{dashboards.length}</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {dashboards.map((db, i) => (
              <Card key={i} className="p-3" data-testid={`dashboard-${i}`}>
                <p className="font-semibold text-sm">{db.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{db.worksheets.length} worksheets</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Worksheets (sampled) */}
        <section data-testid="section-worksheets">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-base">Worksheets</h3>
            <Badge variant="secondary">{summary.totalWorksheets}</Badge>
            <span className="text-xs text-muted-foreground">(showing first {Math.min(worksheets.length, 20)})</span>
          </div>
          <Card className="p-3">
            <div className="flex flex-wrap gap-1.5">
              {worksheets.slice(0, 20).map((ws, i) => (
                <Badge key={i} variant="secondary" className="text-[10px]">{ws.name}</Badge>
              ))}
              {summary.totalWorksheets > 20 && (
                <Badge variant="outline" className="text-[10px]">+{summary.totalWorksheets - 20} more</Badge>
              )}
            </div>
          </Card>
        </section>

        {/* Parameters */}
        {parameters.length > 0 && (
          <section data-testid="section-parameters">
            <div className="flex items-center gap-2 mb-3">
              <SlidersHorizontal className="w-4 h-4 text-primary" />
              <h3 className="font-bold text-base">Parameters</h3>
              <Badge variant="secondary">{parameters.length}</Badge>
            </div>
            <div className="space-y-2">
              {parameters.map((param, i) => {
                const isExpanded = expandedParam.includes(i);
                return (
                  <Card key={i} className="overflow-hidden" data-testid={`parameter-${i}`}>
                    <button
                      className="w-full p-3 text-left flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                      onClick={() => toggleParam(i)}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="text-sm font-medium">{param.name}</span>
                        <Badge variant="outline" className="text-[10px] py-0 h-5">{param.dataType}</Badge>
                        <span className="text-xs text-muted-foreground">Default: <span className="font-medium text-foreground">{param.currentValue}</span></span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-muted-foreground">{param.allowedValues.length} values</span>
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="border-t px-3 py-2.5">
                        <p className="text-xs text-muted-foreground mb-1.5">Allowed values:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {param.allowedValues.map((v, vi) => (
                            <Badge key={vi} variant={v === param.currentValue ? "default" : "secondary"} className="text-[10px]">
                              {v}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* Actions / Filters */}
        {filters.length > 0 && (
          <section data-testid="section-filters">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="w-4 h-4 text-primary" />
              <h3 className="font-bold text-base">Dashboard Actions & Filters</h3>
              <Badge variant="secondary">{filters.length}</Badge>
            </div>
            <div className="space-y-2">
              {filters.map((f, i) => (
                <Card key={i} className="p-3" data-testid={`filter-${i}`}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-sm font-medium">{f.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{f.trigger}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{f.actionType.replace("tsc:tsl-", "")}</Badge>
                  </div>
                  {(f.source || f.target) && (
                    <div className="flex items-center gap-2 mt-2 text-xs">
                      {f.source && <span className="px-2 py-0.5 rounded bg-muted font-medium">{f.source}</span>}
                      {f.source && f.target && <span className="text-muted-foreground">→</span>}
                      {f.target && <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">{f.target}</span>}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Download report */}
        <Card className="p-4 flex items-center justify-between gap-4 flex-wrap" data-testid="card-report-download">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-primary" />
            <span className="text-sm">Download the detailed analysis report</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => {
            const a = document.createElement("a");
            a.href = "/api/download-report";
            a.download = "ddm_tableau_parsed_data_optimized.xlsx";
            a.click();
          }} data-testid="button-download-report">
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Download Report
          </Button>
        </Card>
      </div>
    </div>
  );
}
