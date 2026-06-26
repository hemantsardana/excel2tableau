import { useState, useEffect, useCallback, useMemo } from "react";
import { ArrowLeft, ArrowRight, Download, CheckCircle, Copy, Check, FolderOpen, Folder, FileText, ChevronRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useConverter } from "@/lib/converter-context";
import { useToast } from "@/hooks/use-toast";
import type { GeneratedFile } from "@shared/schema";

interface GenerationPhase {
  name: string;
  description: string;
  progress: number;
  status: "pending" | "active" | "complete";
}

interface TreeNode {
  name: string;
  displayName: string;
  children: TreeNode[];
  file: GeneratedFile | null;
  path: string;
}

function buildFileTree(files: GeneratedFile[]): TreeNode[] {
  const root: TreeNode = { name: "", displayName: "", children: [], file: null, path: "" };

  const pageDisplayNames = new Map<string, string>();
  for (const f of files) {
    if (f.path.endsWith("/page.json")) {
      try {
        const parsed = JSON.parse(f.content);
        if (parsed.displayName) {
          const dirParts = f.path.split("/");
          dirParts.pop();
          const hashDir = dirParts[dirParts.length - 1];
          const pageParentPath = dirParts.join("/");
          pageDisplayNames.set(pageParentPath, parsed.displayName);
        }
      } catch {}
    }
  }

  for (const file of files) {
    const segments = file.path.split("/");
    let current = root;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const isFile = i === segments.length - 1;

      if (isFile) {
        current.children.push({
          name: seg,
          displayName: seg,
          children: [],
          file,
          path: file.path,
        });
      } else {
        let child = current.children.find(c => c.name === seg && !c.file);
        if (!child) {
          const folderPath = segments.slice(0, i + 1).join("/");
          let displayName = seg;
          const pageName = pageDisplayNames.get(folderPath);
          if (pageName) {
            displayName = pageName;
          }
          child = {
            name: seg,
            displayName,
            children: [],
            file: null,
            path: folderPath,
          };
          current.children.push(child);
        }
        current = child;
      }
    }
  }

  sortTree(root.children);
  return root.children;
}

function sortTree(nodes: TreeNode[]) {
  nodes.sort((a, b) => {
    const aIsFolder = !a.file;
    const bIsFolder = !b.file;
    if (aIsFolder && !bIsFolder) return -1;
    if (!aIsFolder && bIsFolder) return 1;
    return a.name.localeCompare(b.name);
  });
  for (const node of nodes) {
    if (node.children.length > 0) sortTree(node.children);
  }
}

function countFiles(nodes: TreeNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.file) count++;
    else count += countFiles(node.children);
  }
  return count;
}

function normalizeTemplateRoot(files: GeneratedFile[]): GeneratedFile[] {
  // The template in `dealerdm/pbi` is rooted at items like:
  // - ddm_migrated.Report/...
  // - ddm_migrated.SemanticModel/...
  // Some generation paths might omit this leading folder; restore it for UI display.
  const templateRoot = "ddm_migrated";

  return files.map((f) => {
    const p = (f.path || "").replace(/\\/g, "/");

    // Already rooted correctly
    if (p.startsWith(`${templateRoot}.`) || p.startsWith(`${templateRoot}/`)) {
      return { ...f, path: p };
    }

    // If the file begins with known PBIP folders, prefix the root
    if (p.startsWith("Report/") || p.startsWith("SemanticModel/")) {
      return { ...f, path: `${templateRoot}.${p}`.replace("./", "") };
    }

    // Otherwise leave as-is (might be API artifacts, docs, etc.)
    return { ...f, path: p };
  });
}

export default function GenerationStep() {
  const { generatedFiles, setCurrentStep, conversionResult } = useConverter();
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(true);
  const [phases, setPhases] = useState<GenerationPhase[]>([
    { name: "TWBX Asset Extraction", description: "Unpacking .twbx archive and extracting XML, data files, and embedded assets", progress: 0, status: "pending" },
    { name: "XML & Data Mapping", description: "Parsing Tableau XML metadata, datasources, joins, and worksheet configurations", progress: 0, status: "pending" },
    { name: "Calculated Fields → DAX", description: "Converting Tableau calculated fields, LOD expressions, and parameters to DAX measures", progress: 0, status: "pending" },
    { name: "Dashboard Visual Conversion", description: "Mapping Tableau dashboard layouts and worksheet visuals to Power BI report pages", progress: 0, status: "pending" },
    { name: "Assembling PBIX Artifacts", description: "Combining SemanticModel, Report definition, and relationships into final .pbip output", progress: 0, status: "pending" },
  ]);
  const [overallProgress, setOverallProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [selectedFile, setSelectedFile] = useState<GeneratedFile | null>(null);
  const [copied, setCopied] = useState(false);

  const normalizedFiles = useMemo(() => normalizeTemplateRoot(generatedFiles), [generatedFiles]);
  const fileTree = useMemo(() => buildFileTree(normalizedFiles), [normalizedFiles]);

  useEffect(() => {
    if (!isGenerating) return;

    const timer = setInterval(() => {
      setElapsed(e => e + 1);
    }, 1000);

    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step <= 9) {
        setPhases(p => p.map((phase, i) => {
          if (i === 0) return { ...phase, status: "active", progress: Math.min(step * 11, 100) };
          return phase;
        }));
        setOverallProgress(step * 2.2);
      } else if (step <= 18) {
        setPhases(p => p.map((phase, i) => {
          if (i === 0) return { ...phase, status: "complete", progress: 100 };
          if (i === 1) return { ...phase, status: "active", progress: Math.min((step - 9) * 11, 100) };
          return phase;
        }));
        setOverallProgress(20 + (step - 9) * 2.2);
      } else if (step <= 27) {
        setPhases(p => p.map((phase, i) => {
          if (i <= 1) return { ...phase, status: "complete", progress: 100 };
          if (i === 2) return { ...phase, status: "active", progress: Math.min((step - 18) * 11, 100) };
          return phase;
        }));
        setOverallProgress(40 + (step - 18) * 2.2);
      } else if (step <= 36) {
        setPhases(p => p.map((phase, i) => {
          if (i <= 2) return { ...phase, status: "complete", progress: 100 };
          if (i === 3) return { ...phase, status: "active", progress: Math.min((step - 27) * 11, 100) };
          return phase;
        }));
        setOverallProgress(60 + (step - 27) * 2.2);
      } else if (step <= 45) {
        setPhases(p => p.map((phase, i) => {
          if (i <= 3) return { ...phase, status: "complete", progress: 100 };
          if (i === 4) return { ...phase, status: "active", progress: Math.min((step - 36) * 11, 100) };
          return phase;
        }));
        setOverallProgress(80 + (step - 36) * 2.2);
      } else {
        setPhases(p => p.map(phase => ({ ...phase, status: "complete", progress: 100 })));
        setOverallProgress(100);
        setIsGenerating(false);
        clearInterval(interval);
        clearInterval(timer);
      }
    }, 100);

    return () => {
      clearInterval(interval);
      clearInterval(timer);
    };
  }, [isGenerating]);

  useEffect(() => {
    if (!isGenerating && normalizedFiles.length > 0 && !selectedFile) {
      setSelectedFile(normalizedFiles[0]);
    }
  }, [isGenerating, normalizedFiles, selectedFile]);

  const handleCopy = useCallback(() => {
    if (selectedFile) {
      navigator.clipboard.writeText(selectedFile.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [selectedFile]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  if (isGenerating) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold" data-testid="text-generating-title">Generating Power BI</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Processing your Tableau workbook and generating Power BI files
          </p>
        </div>

        <Card className="p-6 mb-6" data-testid="card-overall-progress">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold">Overall Progress</span>
            <span className="text-xs text-muted-foreground">{formatTime(elapsed)} elapsed</span>
          </div>
          <Progress value={overallProgress} className="h-2" />
        </Card>

        <div className="space-y-4">
          {phases.map((phase) => (
            <Card
              key={phase.name}
              className={`p-4 transition-colors ${phase.status === "active" ? "border-primary/50" : ""}`}
              data-testid={`phase-${phase.name.toLowerCase().replace(/\s/g, '-')}`}
            >
              <div className="flex items-center gap-3">
                {phase.status === "complete" ? (
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                ) : phase.status === "active" ? (
                  <span className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin flex-shrink-0" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-muted flex-shrink-0" />
                )}
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-sm">{phase.name}</p>
                    <span className={`text-xs ${phase.status === "complete" ? "text-green-500" : phase.status === "active" ? "text-primary" : "text-muted-foreground"}`}>
                      {phase.status === "complete" ? "Complete" : phase.status === "active" ? `${Math.round(phase.progress)}%` : "Pending"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{phase.description}</p>
                  {phase.status === "active" && (
                    <Progress value={phase.progress} className="h-1.5 mt-2" />
                  )}
                  {phase.status === "complete" && (
                    <Progress value={100} className="h-1.5 mt-2" />
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Please wait while we process your files.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-generated-title">Generated Power BI Files</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Download your converted files and preview the output
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setCurrentStep("planning")} data-testid="button-back-planning">
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
            Back
          </Button>
          <Button onClick={() => setCurrentStep("validation")} data-testid="button-validate">
            Validate Conversion
            <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </Button>
        </div>
      </div>

      <Card className="p-4 mb-4 flex items-center justify-between gap-4 flex-wrap" data-testid="card-download-pbix">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Download className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm">Power BI Report Ready</p>
            <p className="text-xs text-muted-foreground">Download the compiled .pbix file to open in Power BI Desktop</p>
          </div>
        </div>
        <Button
          onClick={() => {
            const a = document.createElement("a");
            a.href = "/api/download-pbix";
            a.download = "ddm_migrated.pbix";
            a.click();
          }}
          data-testid="button-download-pbix"
        >
          <Download className="w-4 h-4 mr-2" />
          Download .pbix
        </Button>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-4">
        <Card className="p-0 overflow-hidden" data-testid="card-file-tree">
          <div className="p-3 border-b">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">Project Structure</span>
              <Badge variant="secondary">{normalizedFiles.length} files</Badge>
            </div>
          </div>
          <ScrollArea className="h-[500px]">
            <div className="p-2">
              {fileTree.map((node) => (
                <TreeNodeView
                  key={node.path || node.name}
                  node={node}
                  depth={0}
                  selectedFile={selectedFile}
                  onSelect={setSelectedFile}
                />
              ))}
            </div>
          </ScrollArea>
        </Card>

        <Card className="p-0 overflow-hidden" data-testid="card-file-preview">
          {selectedFile ? (
            <>
              <div className="p-3 border-b flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-mono text-muted-foreground truncate">{selectedFile.path}</span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => {
                    const a = document.createElement("a");
                    a.href = `/api/download-file?path=${encodeURIComponent(selectedFile.path)}`;
                    a.download = selectedFile.name;
                    a.click();
                  }} data-testid="button-download-file">
                    <Download className="w-3.5 h-3.5 mr-1" />
                    Download
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleCopy} data-testid="button-copy-content">
                    {copied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>
              <ScrollArea className="h-[460px]">
                <pre className="p-4 text-xs font-mono leading-relaxed whitespace-pre-wrap">
                  {selectedFile.content}
                </pre>
              </ScrollArea>
            </>
          ) : (
            <div className="h-[500px] flex items-center justify-center text-muted-foreground text-sm">
              Select a file to preview
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function TreeNodeView({
  node,
  depth,
  selectedFile,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  selectedFile: GeneratedFile | null;
  onSelect: (f: GeneratedFile) => void;
}) {
  const isFolder = !node.file;
  const [expanded, setExpanded] = useState(depth < 2);

  if (!isFolder) {
    return (
      <button
        className={`flex items-center gap-1.5 w-full text-left py-1 rounded-md text-xs truncate ${
          selectedFile?.path === node.file!.path
            ? "bg-primary/10 text-primary font-medium"
            : "text-muted-foreground hover-elevate"
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px`, paddingRight: 8 }}
        onClick={() => onSelect(node.file!)}
        data-testid={`file-${node.name}`}
      >
        <FileText className="w-3 h-3 flex-shrink-0" />
        <span className="truncate">{node.displayName}</span>
      </button>
    );
  }

  const fileCount = countFiles(node.children);

  return (
    <div>
      <button
        className="flex items-center gap-1 w-full text-left py-1 rounded-md text-xs font-medium hover-elevate"
        style={{ paddingLeft: `${depth * 12 + 4}px`, paddingRight: 8 }}
        onClick={() => setExpanded(!expanded)}
        data-testid={`folder-${node.displayName}`}
      >
        {expanded ? <ChevronDown className="w-3 h-3 flex-shrink-0" /> : <ChevronRight className="w-3 h-3 flex-shrink-0" />}
        {expanded ? (
          <FolderOpen className="w-3.5 h-3.5 text-primary flex-shrink-0" />
        ) : (
          <Folder className="w-3.5 h-3.5 text-primary flex-shrink-0" />
        )}
        <span className="truncate">{node.displayName}</span>
        <Badge variant="secondary" className="ml-auto text-[10px] flex-shrink-0">{fileCount}</Badge>
      </button>
      {expanded && (
        <div>
          {node.children.map((child) => (
            <TreeNodeView
              key={child.path || child.name}
              node={child}
              depth={depth + 1}
              selectedFile={selectedFile}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
