import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import fs from "fs";
import path from "path";
import { storage } from "./storage";
import { parseTwbFile } from "./twb-parser";
import { generatePowerBIFiles, generateValidation } from "./powerbi-generator";
import archiver from "archiver";

const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Extract TWBX file - use pre-built DDM data for demo
  app.post("/api/extract", upload.fields([
    { name: "twbFile", maxCount: 1 },
  ]), async (req, res) => {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const twbFile = files?.twbFile?.[0];

      if (!twbFile) {
        return res.status(400).json({ error: "No TWBX file provided" });
      }

      // Load DDM optimized JSON for demo
      const ddmJsonPath = path.join(process.cwd(), "dealerdm", "json_output", "ddm_tableau_parsed_data_optimized.json");
      if (!fs.existsSync(ddmJsonPath)) {
        return res.status(500).json({ error: "DDM data file not found" });
      }
      const ddmData = JSON.parse(fs.readFileSync(ddmJsonPath, "utf-8"));

      // Build ExtractionResult from DDM JSON
      const uniqueTableNames = new Set<string>();
      const datasources = ddmData.datasources.map((ds: any, idx: number) => {
        // Filter tables to unique core names (skip bracket variants)
        const coreTableNames = new Set<string>();
        const tables = ds.tables
          .filter((t: any) => {
            const clean = t.name.replace(/[\[\]'$]/g, "").trim().replace(/\.\[.*\]$/, "");
            if (coreTableNames.has(clean)) return false;
            coreTableNames.add(clean);
            return true;
          })
          .map((t: any) => {
            const cleanName = t.name.replace(/[\[\]'$]/g, "").trim().replace(/\.\[.*\]$/, "");
            uniqueTableNames.add(cleanName);
            return {
              name: cleanName,
              columns: (t.columns || []).map((c: any) => ({
                name: c.name,
                caption: c.caption || undefined,
                datatype: c.datatype || "string",
                role: c.role || "dimension",
              })),
            };
          });

        const calculatedFields = (ds.calculated_fields || []).map((cf: any) => ({
          name: cf.name,
          caption: cf.caption || cf.name,
          formula: cf.calculation || "",
          datatype: cf.datatype || "string",
          role: cf.role || "dimension",
        }));

        const joins = (ds.joins || []).map((j: any) => ({
          left: j.left_table || "",
          right: j.right_table || "",
          condition: j.join_type || "inner",
        }));

        return {
          name: idx === 0 ? "Dealer DM (TWG Matchback)" : "Dealer DM (Matchback)",
          connection: `${ds.connection?.dbms || "federated"} / ${ds.connection?.server || "localhost"}`,
          tables,
          joins,
          calculatedFields,
        };
      });

      const worksheets = (ddmData.metadata?.worksheets || [])
        .slice(0, 50)
        .map((ws: any) => ({ name: ws.name || ws, datasource: undefined, fields: [] }));

      const dashboards = (ddmData.metadata?.dashboards || []).map((db: any) => ({
        name: db.name,
        worksheets: Array.isArray(db.worksheets_used) ? db.worksheets_used.map((w: any) => (typeof w === "string" ? w.trim() : w)) : [],
      }));

      const parameters = (ddmData.visuals?.parameters || []).map((p: any) => ({
        name: p.parameter_name,
        dataType: p.data_type,
        currentValue: p.current_value?.replace(/^"|"$/g, "") || "",
        allowedValues: (p.allowed_values || []).map((v: string) => v.replace(/^"|"$/g, "")),
      }));

      const filters = (ddmData.visuals?.actions || []).map((a: any) => ({
        name: a.action_name,
        trigger: a.trigger || "When user clicks/selects",
        source: a.source?.dashboard || a.source?.worksheet || "",
        target: a.details?.target_sheet || "",
        actionType: a.action_type || "filter",
      }));

      const totalCalcFields = datasources.reduce((sum: number, ds: any) => sum + ds.calculatedFields.length, 0);
      const totalCols = datasources.reduce((sum: number, ds: any) =>
        sum + ds.tables.reduce((s2: number, t: any) => s2 + t.columns.length, 0), 0);

      const extractionResult = {
        datasources,
        worksheets,
        dashboards,
        parameters,
        filters,
        summary: {
          totalDatasources: datasources.length,
          totalTables: uniqueTableNames.size,
          totalCalculatedFields: totalCalcFields,
          totalColumns: totalCols,
          totalDashboards: dashboards.length,
          totalWorksheets: ddmData.metadata?.worksheets?.length || worksheets.length,
          totalParameters: parameters.length,
          totalFilters: filters.length,
        },
      };

      storage.setExtractionResult(extractionResult);
      res.json(extractionResult);
    } catch (err: any) {
      console.error("Extraction error:", err);
      res.status(500).json({ error: "Failed to extract file", details: err.message });
    }
  });

  // Generate Power BI files
  app.post("/api/generate", async (req, res) => {
    try {
      const extraction = storage.getExtractionResult();
      if (!extraction) {
        return res.status(400).json({ error: "No extraction data available. Please upload a file first." });
      }

      const sqlContents = storage.getSqlContents();
      const result = generatePowerBIFiles(extraction, sqlContents);
      storage.setConversionResult(result);

      res.json(result);
    } catch (err: any) {
      console.error("Generation error:", err);
      res.status(500).json({ error: "Failed to generate Power BI files", details: err.message });
    }
  });

  // Validate conversion
  app.post("/api/validate", async (req, res) => {
    try {
      const extraction = storage.getExtractionResult();
      const conversion = storage.getConversionResult();

      if (!extraction || !conversion) {
        return res.status(400).json({ error: "No conversion data available." });
      }

      const validation = generateValidation(extraction, conversion);
      storage.setValidationResult(validation);

      res.json(validation);
    } catch (err: any) {
      console.error("Validation error:", err);
      res.status(500).json({ error: "Validation failed", details: err.message });
    }
  });

  // Download all generated files as ZIP
  app.get("/api/download-all", async (req, res) => {
    try {
      const files = storage.getGeneratedFiles();
      if (files.length === 0) {
        return res.status(400).json({ error: "No files to download" });
      }

      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", "attachment; filename=ddm_migrated_pbi.zip");

      const archive = archiver("zip", { zlib: { level: 9 } });
      archive.pipe(res);

      for (const file of files) {
        archive.append(file.content, { name: file.path });
      }

      await archive.finalize();
    } catch (err: any) {
      console.error("Download error:", err);
      res.status(500).json({ error: "Failed to create download", details: err.message });
    }
  });

  // Download Excel report
  app.get("/api/download-report", (req, res) => {
    try {
      const filePath = path.join(process.cwd(), "dealerdm", "reports", "ddm_tableau_parsed_data_optimized.xlsx");
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Report file not found" });
      }
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", 'attachment; filename="ddm_tableau_parsed_data_optimized.xlsx"');
      fs.createReadStream(filePath).pipe(res);
    } catch (err: any) {
      res.status(500).json({ error: "Download failed" });
    }
  });

  // Download PBIX file
  app.get("/api/download-pbix", (req, res) => {
    try {
      const filePath = path.join(process.cwd(), "dealerdm", "pbi", "ddm_migrated.pbix");
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "PBIX file not found" });
      }
      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader("Content-Disposition", 'attachment; filename="ddm_migrated.pbix"');
      fs.createReadStream(filePath).pipe(res);
    } catch (err: any) {
      res.status(500).json({ error: "Download failed" });
    }
  });

  // Download individual file
  app.get("/api/download-file", (req, res) => {
    try {
      const filePath = req.query.path as string;
      if (!filePath) return res.status(400).json({ error: "No file path specified" });
      
      const files = storage.getGeneratedFiles();
      const file = files.find(f => f.path === filePath);
      if (!file) return res.status(404).json({ error: "File not found" });

      const ext = path.extname(file.path).toLowerCase();
      const contentTypes: Record<string, string> = {
        ".json": "application/json",
        ".xml": "application/xml",
        ".tmdl": "text/plain",
        ".dax": "text/plain",
        ".pbip": "text/plain",
        ".pbir": "text/plain",
        ".pbism": "text/plain",
      };
      const contentType = contentTypes[ext] || "text/plain";
      const downloadName = path.basename(file.path);
      
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
      res.send(file.content);
    } catch (err: any) {
      res.status(500).json({ error: "Download failed" });
    }
  });

  // Get extraction result
  app.get("/api/extraction", (req, res) => {
    const result = storage.getExtractionResult();
    if (!result) return res.status(404).json({ error: "No extraction data" });
    res.json(result);
  });

  // Get generated files
  app.get("/api/files", (req, res) => {
    const files = storage.getGeneratedFiles();
    res.json(files);
  });

  // Reset state
  app.post("/api/reset", (req, res) => {
    storage.reset();
    res.json({ success: true });
  });

  // Serve calculated fields dependency levels
  app.get("/api/calc-field-levels", (req, res) => {
    try {
      const filePath = path.join(process.cwd(), "dealerdm", "json_output", "calculated_fields_dependency_report.json");
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Dependency report not found" });
      }
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      res.json(data);
    } catch {
      res.status(500).json({ error: "Failed to load dependency report" });
    }
  });

  // Serve lineage HTML report
  app.get("/api/lineage-html", (req, res) => {
    try {
      const filePath = path.join(process.cwd(), "dealerdm", "reports", "lineage.html");
      if (!fs.existsSync(filePath)) {
        return res.status(404).send("<h2>Lineage report not found</h2>");
      }
      let html = fs.readFileSync(filePath, "utf-8");

      // Comprehensive light-theme override matching the app's orange/slate palette
      const lightTheme = `<style>
/* ── Reset dark base ── */
*,*::before,*::after{box-sizing:border-box}
html,body{overflow:auto!important;height:100%!important;background:#f9fafb!important;color:#111827!important;font-family:'Segoe UI',system-ui,-apple-system,sans-serif!important}
::-webkit-scrollbar{width:6px;height:6px}
::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:3px}
::-webkit-scrollbar-track{background:#f3f4f6}

/* ── Header ── */
header{background:#fff!important;border-bottom:1px solid #e5e7eb!important;backdrop-filter:none!important;box-shadow:0 1px 4px rgba(0,0,0,.06)!important}
header h1{color:#111827!important}
#hdrSub{color:#6b7280!important}
header label{color:#6b7280!important}

/* ── Dropdowns ── */
select#ddM,select#ddC{background:#fff!important;color:#111827!important;border:1px solid #d1d5db!important;border-radius:8px!important;padding:6px 12px!important;font-size:13px!important;outline:none;transition:border-color .2s}
select#ddM:hover,select#ddC:hover,select#ddM:focus,select#ddC:focus{border-color:#ea580c!important;box-shadow:0 0 0 3px rgba(234,88,12,.12)!important}

/* ── Summary bar ── */
#summaryBar{color:#4b5563!important}
.summary-val{font-size:15px!important;font-weight:700!important}

/* ── Placeholder ── */
#placeholder{color:#9ca3af!important}
#placeholder h2{color:#6b7280!important}
#phM{color:#ea580c!important}
#phC{color:#f97316!important}
#phB{color:#16a34a!important}
#phP{color:#2563eb!important}

/* ── Main flow area ── */
#mainArea{background:#f9fafb!important}
#flowC{background:#f9fafb!important}

/* ── Column headers ── */
.col-anim > div:first-child > div{color:#6b7280!important}

/* ── Node cards — reset dark backgrounds ── */
.node-card{border-radius:12px!important;box-shadow:0 1px 4px rgba(0,0,0,.07)!important;transition:all .25s ease!important}
.node-card:hover{transform:translateY(-2px)!important;box-shadow:0 6px 20px rgba(0,0,0,.10)!important}
.node-card.dimmed{opacity:.18!important;filter:none!important}

/* Source cards — green tint */
.node-card[style*="background:#0d1f17"]{background:#f0fdf4!important;border-color:#bbf7d0!important}
.node-card[style*="background:#0d1f17"]:hover{border-color:#22c55e!important}
/* Step/calc cards — blue tint */
.node-card[style*="background:#111832"]{background:#eff6ff!important;border-color:#bfdbfe!important}
.node-card[style*="background:#111832"]:hover{border-color:#60a5fa!important}
/* Focus cards — orange/amber tint */
.node-card[style*="background:#1c1a08"]{background:#fff7ed!important;border-color:#fed7aa!important}
.node-card[style*="background:#1c1a08"]:hover{border-color:#ea580c!important}
/* Target cards — red tint */
.node-card[style*="background:#1c0f12"]{background:#fef2f2!important;border-color:#fecaca!important}
.node-card[style*="background:#1c0f12"]:hover{border-color:#f87171!important}

/* ── Card color connectors ── */
.conn{opacity:.8}

/* ── Card header text ── */
.card-header{padding:12px 14px!important}
/* Field name (white in dark theme) */
[style*="color:#fff"]{color:#111827!important}
[style*="color:#ffffff"]{color:#111827!important}
/* Internal name */
[style*="color:#475569"]{color:#6b7280!important}
/* Datasource text */
[style*="color:#334155"]{color:#4b5563!important}

/* ── Meta pills ── */
.meta-pill{font-size:10px!important;font-weight:600!important;border-radius:6px!important;padding:2px 8px!important}
/* category pills — source green */
[style*="background:#064e3b"]{background:#dcfce7!important;color:#15803d!important}
/* step blue */
[style*="background:#1e3a5f"]{background:#dbeafe!important;color:#1d4ed8!important}
/* focus amber */
[style*="background:#451a03"]{background:#ffedd5!important;color:#c2410c!important}
/* target red */
[style*="background:#450a0a"]{background:#fee2e2!important;color:#b91c1c!important}
/* datatype / role dark pills */
[style*="background:#1e293b"]{background:#f1f5f9!important;color:#475569!important}
/* complexity indigo */
[style*="background:#312e81"]{background:#ede9fe!important;color:#6d28d9!important}

/* ── Detail panel ── */
.detail-panel{border-top:1px solid #e5e7eb!important}
.detail-panel .dt{color:#9ca3af!important}
.detail-panel .dd{color:#374151!important}
.formula-box{background:#f8fafc!important;color:#0f172a!important;border:1px solid #e2e8f0!important;border-radius:8px!important}
/* hint text */
[style*="color:#334155"][style*="font-size:9px"]{color:#9ca3af!important}

/* ── SVG connector lines ── */
#svgC path[stroke="#2d3154"]{stroke:#d1d5db!important}
#svgC path[stroke="#818cf8"]{stroke:#ea580c!important}

/* ── Side detail panel ── */
#sidePanel{position:absolute!important;background:#fff!important;border-left:1px solid #e5e7eb!important;box-shadow:-4px 0 20px rgba(0,0,0,.08)!important;backdrop-filter:none!important}
#sidePanel .sp-title{color:#111827!important}
#sidePanel .sp-close{color:#9ca3af!important}
#sidePanel .sp-close:hover{color:#111827!important}
#sidePanel .sp-lbl{color:#9ca3af!important}
#sidePanel .sp-val{color:#374151!important}
#sidePanel .path-line{background:#f8fafc!important;color:#374151!important;border:1px solid #e5e7eb!important;border-radius:6px!important}

/* ── Legend labels in header ── */
header [style*="color:#94a3b8"]{color:#6b7280!important}

/* ── Help legend box ── */
#helpBox{position:sticky!important;bottom:8px;background:#fff!important;border:1px solid #e5e7eb!important;box-shadow:0 2px 12px rgba(0,0,0,.08)!important;color:#4b5563!important;backdrop-filter:none!important}
#helpBox h3{color:#111827!important}
#helpBox p,#helpBox ul,#helpBox li{color:#4b5563!important}
#helpBox .chevron{stroke:#4b5563!important}

/* ── Summary bar pills ── */
[style*="background:#312e81;color:#a5b4fc"]{background:#ede9fe!important;color:#6d28d9!important;border:1px solid #ddd6fe!important}
[style*="background:#1e3a5f;color:#93c5fd"]{background:#dbeafe!important;color:#1d4ed8!important;border:1px solid #bfdbfe!important}

/* ── Animated fade-up ── */
@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
</style>`;

      // Also patch the JS so SVG arrows and highlight colors use light-theme values
      const jsPatches = `<script>
(function(){
  // Override PAL colors for light theme
  window.addEventListener('DOMContentLoaded', function() {
    const origPAL = window.PAL;
    if (!origPAL) return;
    // Reassign PAL to light values — will affect new renderFlow calls
    Object.assign(origPAL.source, {bg:'#f0fdf4',bd:'#bbf7d0',hv:'#22c55e',glow:'rgba(22,163,74,.12)',tag:'#dcfce7',tagTxt:'#15803d'});
    Object.assign(origPAL.step,   {bg:'#eff6ff',bd:'#bfdbfe',hv:'#60a5fa',glow:'rgba(59,130,246,.12)',tag:'#dbeafe',tagTxt:'#1d4ed8'});
    Object.assign(origPAL.focus,  {bg:'#fff7ed',bd:'#fed7aa',hv:'#ea580c',glow:'rgba(234,88,12,.14)',tag:'#ffedd5',tagTxt:'#c2410c'});
    Object.assign(origPAL.target, {bg:'#fef2f2',bd:'#fecaca',hv:'#f87171',glow:'rgba(239,68,68,.12)',tag:'#fee2e2',tagTxt:'#b91c1c'});

    // Patch badge text colors to dark
    const origRenderCols = window.renderCols;
    // Patch drawLines arrow colors
    const origDrawLines = window.drawLines;
    if (origDrawLines) {
      window.drawLines = function(flow) {
        origDrawLines(flow);
        // Re-color arrows after draw
        document.querySelectorAll('#svgC path').forEach(function(p) {
          if (p.id !== 'undefined' && p.getAttribute('fill') === '#2d3154') {
            p.setAttribute('fill','#9ca3af');
          }
          if (p.getAttribute('stroke') === '#2d3154') p.setAttribute('stroke','#d1d5db');
          if (p.getAttribute('fill') === '#2d3154' && p.tagName === 'path') {
            // arrow head in defs
            p.setAttribute('fill','#9ca3af');
          }
        });
        // Fix arrow marker fill in defs
        document.querySelectorAll('#svgC defs marker path').forEach(function(p){
          p.setAttribute('fill','#9ca3af');
        });
      };
    }
    // Patch hlNode to use orange highlight
    const origHlNode = window.hlNode;
    if (origHlNode) {
      window.hlNode = function(n) {
        origHlNode(n);
        document.querySelectorAll('#svgC .cline').forEach(function(p) {
          if (p.getAttribute('stroke') === '#818cf8') {
            p.setAttribute('stroke','#ea580c');
          }
          var mEnd = p.getAttribute('marker-end');
          if (mEnd && mEnd.includes('arwH')) {
            // highlighted arrow marker — already orange via defs patch below
          }
        });
        // Re-patch highlight marker
        var m2 = document.querySelector('#svgC #arwH path');
        if (m2) m2.setAttribute('fill','#ea580c');
      };
    }
    // Patch clrHL to use light connector color
    const origClrHL = window.clrHL;
    if (origClrHL) {
      window.clrHL = function() {
        origClrHL();
        document.querySelectorAll('#svgC .cline').forEach(function(p){
          p.setAttribute('stroke','#d1d5db');
        });
      };
    }
  });
})();
<\/script>`;

      html = html.replace("</head>", lightTheme + "</head>");
      html = html.replace("</body>", jsPatches + "</body>");
      res.setHeader("Content-Type", "text/html");
      res.send(html);
    } catch {
      res.status(500).send("<h2>Failed to load lineage report</h2>");
    }
  });

  // Serve validation HTML report with light theme
  app.get("/api/validation-html", (req, res) => {
    try {
      const filePath = path.join(process.cwd(), "dealerdm", "reports", "validation_report.html");
      if (!fs.existsSync(filePath)) {
        return res.status(404).send("Validation report not found");
      }
      let html = fs.readFileSync(filePath, "utf-8");
      const lightTheme = `<style>
/* ── Light theme overrides for embedded iframe ── */
body{background:#f9fafb!important;color:#111827!important;font-family:'Open Sans','Segoe UI',system-ui,sans-serif!important}
.glass{background:#ffffff!important;border:1px solid #e5e7eb!important;box-shadow:0 1px 3px rgba(0,0,0,.04)!important}
.stat-card{background:#ffffff!important;border:1px solid #e5e7eb!important;box-shadow:0 1px 2px rgba(0,0,0,.03)!important}
.stat-card:hover{box-shadow:0 2px 8px rgba(0,0,0,.06)!important;border-color:#d1d5db!important}
.stat-card .lbl{color:#6b7280!important}
.stat-card .num{color:#ea580c!important}
.section h3{color:#111827!important}
.tbl th{background:#f9fafb!important;color:#6b7280!important;border-bottom:2px solid #e5e7eb!important}
.tbl td{border-bottom:1px solid #f3f4f6!important;color:#374151!important}
.tbl td .badge{color:inherit!important}
.tbl tr:hover td{background:#fef7f2!important}
.tbl tr:nth-child(even) td{background:#fafafa}
.tab-btn{color:#6b7280!important;background:transparent!important}
.tab-btn:hover:not(.active){color:#374151!important;background:#f3f4f6!important}
.tab-btn.active{background:rgba(234,88,12,.07)!important;color:#ea580c!important;border-color:rgba(234,88,12,.18)!important;box-shadow:0 1px 2px rgba(234,88,12,.06)!important}
.progress-bar{background:#e5e7eb!important}
.progress-fill{background:#ea580c!important}
.dc-sidebar{background:#ffffff!important;border:1px solid #e5e7eb!important;box-shadow:0 1px 3px rgba(0,0,0,.04)!important}
.dc-dash-item{color:#6b7280!important;border-bottom:1px solid #f3f4f6!important}
.dc-dash-item:hover{background:#fef7f2!important;color:#374151!important}
.dc-dash-item.active{background:rgba(234,88,12,.05)!important;color:#ea580c!important;border-left:3px solid #ea580c!important}
.dc-ws-pill{color:#6b7280!important}
.dc-ws-pill.active{background:rgba(234,88,12,.07)!important;color:#ea580c!important;border-color:rgba(234,88,12,.18)!important}
.dc-ws-pill:hover:not(.active){color:#374151!important;background:#f9fafb!important}
.dc-tbl-wrap{background:#ffffff!important;border:1px solid #e5e7eb!important}
.dc-stat{color:#6b7280!important}
.dc-stat b{color:#374151!important}
.dc-half-header{background:#f9fafb!important;color:#374151!important;border:1px solid #e5e7eb!important;border-bottom:none!important}
h1,.text-white{color:#111827!important}
.text-slate-500{color:#6b7280!important}
.score-ring .value{color:#111827!important}
/* Override inline dark-theme text colors set by JS */
[style*="color:#cbd5e1"]{color:#374151!important}
[style*="color:#94a3b8"]{color:#4b5563!important}
[style*="color:#e2e8f0"]{color:#111827!important}
[style*="color:#64748b"]{color:#6b7280!important}
h3[style*="color:#fff"]{color:#111827!important}
p[style*="color:#fff"]{color:#111827!important}
div.glass h3[style*="color:#fff"]{color:#111827!important}
/* Override rainbow accent colors to unified orange */
[style*="color:#e879f9"]{color:#ea580c!important}
[style*="color:#22d3ee"]{color:#ea580c!important}
[style*="color:#818cf8"]{color:#ea580c!important}
[style*="color:#a78bfa"]{color:#ea580c!important}
[style*="color:#6366f1"]{color:#ea580c!important}
[style*="color:#f59e0b"]{color:#ea580c!important}
/* Semantic heading colors */
h3[style*="color:#10b981"]{color:#059669!important}
h3[style*="color:#f87171"]{color:#dc2626!important}
h3[style*="color:#60a5fa"]{color:#2563eb!important}
/* Override dark-bg badges from JS inline styles */
.badge[style*="background:rgba(0,0,0"]{background:#f3f4f6!important;border:1px solid #e5e7eb!important}
svg circle[stroke="#1e2040"]{stroke:#e5e7eb!important}
/* Risk pills */
.risk-low{background:#ecfdf5!important;color:#059669!important;border:1px solid #d1fae5!important}
.risk-medium{background:#fffbeb!important;color:#d97706!important;border:1px solid #fef3c7!important}
.risk-high{background:#fef2f2!important;color:#dc2626!important;border:1px solid #fecaca!important}
/* Badge semantic colors */
.badge-exact{background:#ecfdf5!important;color:#059669!important;border:1px solid #d1fae5!important}
.badge-approximate{background:#eff6ff!important;color:#2563eb!important;border:1px solid #dbeafe!important}
.badge-partial{background:#fffbeb!important;color:#d97706!important;border:1px solid #fef3c7!important}
.badge-incorrect{background:#fef2f2!important;color:#dc2626!important;border:1px solid #fecaca!important}
.badge-unknown{background:#f3f4f6!important;color:#6b7280!important;border:1px solid #e5e7eb!important}
.badge-matched{background:#ecfdf5!important;color:#059669!important;border:1px solid #d1fae5!important}
.badge-missing{background:#fef2f2!important;color:#dc2626!important;border:1px solid #fecaca!important}
.badge-extra{background:#eff6ff!important;color:#2563eb!important;border:1px solid #dbeafe!important}
</style>`;
      html = html.replace("</head>", lightTheme + "\n</head>");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
    } catch {
      res.status(500).send("Failed to serve validation report");
    }
  });

  return httpServer;
}
