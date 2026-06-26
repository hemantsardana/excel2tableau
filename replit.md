# Tableau to Power BI Converter

## Overview
A web-based tool that converts Tableau workbook files (.twb/.twbx) into Power BI format. Features a 5-step wizard:
1. **Upload** - Upload Tableau .twb/.twbx file and optional SQL files
2. **Extraction** - Component analysis showing datasources, tables, calculated fields, dashboards
3. **Planning** - Conversion flow diagram, pipeline steps, conversion plan, requirements
4. **Generation** - Generates Power BI files (DataModel, Report pages, visuals, DAX, Power Query M)
5. **Validation** - Conversion progress tracking and dashboard validation report

## Architecture
- **Frontend**: React + TypeScript + Vite + TailwindCSS + shadcn/ui
- **Backend**: Express.js with multer for file uploads
- **State**: React Context for wizard state, in-memory server storage
- **Routing**: wouter for frontend routing

## Key Files
- `client/src/lib/converter-context.tsx` - Wizard state management
- `client/src/pages/upload-step.tsx` - File upload UI
- `client/src/pages/extraction-step.tsx` - Component analysis display
- `client/src/pages/planning-step.tsx` - Conversion planning with flow diagram
- `client/src/pages/generation-step.tsx` - File generation with progress + preview
- `client/src/pages/validation-step.tsx` - Validation report
- `server/twb-parser.ts` - TWB XML parser
- `server/powerbi-generator.ts` - Power BI file generator
- `server/routes.ts` - API endpoints

## API Endpoints
- `POST /api/extract` - Upload & parse TWB + SQL files
- `POST /api/generate` - Generate Power BI output
- `POST /api/validate` - Validate conversion
- `GET /api/download-all` - Download as ZIP

## Validation Logic
- **Calculations & DAX**: Dynamically built from `attached_assets/online_shopping_analytics_tableau_parsed_data_1770906607560.json` (calculated_fields + worksheet fields_used + kpi_fields merged) cross-referenced with `CalculatedFields.dax` for DAX targets
- **Formatting & Theme**: Static checks per dashboard (number formats, color themes, layout)
- **Chart Types & Visuals**: Dynamically reads actual PBIP template visual.json files
- Validation has 3 categories; overall score = average of 3 category scores
- Excluded dashboards: "Online Shopping Insights Hub v2", "Location Analysis"

## Theme
Orange primary color (hsl 24 95% 53%) matching EXL branding.
