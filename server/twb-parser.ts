import { parseStringPromise } from "xml2js";
import type { ExtractionResult, Datasource, Worksheet, Dashboard } from "@shared/schema";

export async function parseTwbFile(xmlContent: string): Promise<ExtractionResult> {
  const result = await parseStringPromise(xmlContent, { explicitArray: false, mergeAttrs: true });
  const workbook = result.workbook;

  const datasources: Datasource[] = [];
  const worksheets: Worksheet[] = [];
  const dashboards: Dashboard[] = [];

  // Parse datasources
  const dsNode = workbook?.datasources?.datasource;
  const dsArray = Array.isArray(dsNode) ? dsNode : dsNode ? [dsNode] : [];

  for (const ds of dsArray) {
    if (ds.name === "Parameters") continue;

    const tables: Datasource["tables"] = [];
    const joins: Datasource["joins"] = [];
    const calculatedFields: Datasource["calculatedFields"] = [];
    let connectionName = ds.caption || ds.name || "Unknown";

    // Parse connection info
    const conn = ds.connection;
    let connType = "unknown";
    if (conn) {
      connType = conn.class || conn["named-connection"]?.connection?.class || "federated";
    }

    // Parse columns/metadata
    const colNode = ds.column;
    const columns = Array.isArray(colNode) ? colNode : colNode ? [colNode] : [];

    const tableMap = new Map<string, { name: string; columns: { name: string; caption?: string; datatype: string; role: string }[] }>();

    for (const col of columns) {
      const name = col.name?.replace(/[\[\]]/g, "") || "";
      const caption = col.caption || name;
      const datatype = col.datatype || "string";
      const role = col.role || "dimension";

      // Check if it's a calculated field
      const calcNode = col.calculation;
      if (calcNode) {
        const formula = calcNode.formula || "";
        calculatedFields.push({
          name,
          caption,
          formula: decodeXmlEntities(formula),
          datatype,
          role,
        });
      }

      // Extract table name from naming convention
      let tableName = "Default";
      if (name.includes(".")) {
        tableName = name.split(".")[0];
      }

      if (!name.startsWith(":") && !name.startsWith("__")) {
        if (!tableMap.has(tableName)) {
          tableMap.set(tableName, { name: tableName, columns: [] });
        }
        tableMap.get(tableName)!.columns.push({ name, caption, datatype, role });
      }
    }

    // Parse metadata for table info
    const metaRecords = ds?.connection?.["metadata-records"]?.["metadata-record"];
    const metaArr = Array.isArray(metaRecords) ? metaRecords : metaRecords ? [metaRecords] : [];

    const discoveredTables = new Set<string>();
    for (const meta of metaArr) {
      if (meta.class === "column") {
        const tableParts = meta?.["parent-name"]?._?.match(/\[([^\]]+)\]/);
        if (tableParts) {
          discoveredTables.add(tableParts[1]);
        }
      }
    }

    // Parse relation/join info
    const relation = conn?.relation;
    if (relation) {
      parseRelations(relation, discoveredTables, joins);
    }

    // Build tables from discovered tables
    for (const tableName of discoveredTables) {
      if (!tableMap.has(tableName)) {
        tableMap.set(tableName, { name: tableName, columns: [] });
      }
    }

    // If no tables discovered but we have columns, create a default table
    if (tableMap.size === 0 && columns.length > 0) {
      tableMap.set("Default", {
        name: "Default",
        columns: columns
          .filter(c => !c.name?.startsWith(":") && !c.name?.startsWith("__"))
          .map(c => ({
            name: c.name?.replace(/[\[\]]/g, "") || "",
            caption: c.caption,
            datatype: c.datatype || "string",
            role: c.role || "dimension",
          })),
      });
    }

    for (const [, table] of tableMap) {
      tables.push(table);
    }

    datasources.push({
      name: connectionName,
      connection: connType,
      tables,
      joins,
      calculatedFields,
    });
  }

  // Parse worksheets
  const wsNode = workbook?.worksheets?.worksheet;
  const wsArray = Array.isArray(wsNode) ? wsNode : wsNode ? [wsNode] : [];

  for (const ws of wsArray) {
    const name = ws.name || "Unnamed";
    const fields: string[] = [];

    // Extract fields from table panes
    const tpNode = ws?.table?.view?.datasources?.datasource;
    const dsRef = Array.isArray(tpNode) ? tpNode : tpNode ? [tpNode] : [];

    worksheets.push({
      name,
      datasource: dsRef.length > 0 ? (dsRef[0].caption || dsRef[0].name) : undefined,
      fields,
    });
  }

  // Parse dashboards
  const dbNode = workbook?.dashboards?.dashboard;
  const dbArray = Array.isArray(dbNode) ? dbNode : dbNode ? [dbNode] : [];

  for (const db of dbArray) {
    const name = db.name || "Unnamed";
    const wsUsed: string[] = [];

    // Parse zones to find worksheet references
    const zones = db?.zones?.zone;
    extractWorksheetNames(zones, wsUsed);

    dashboards.push({
      name: cleanDashboardName(name),
      worksheets: [...new Set(wsUsed)],
    });
  }

  const totalColumns = datasources.reduce(
    (acc, ds) => acc + ds.tables.reduce((a, t) => a + t.columns.length, 0),
    0
  );

  const totalCalculatedFields = datasources.reduce(
    (acc, ds) => acc + ds.calculatedFields.length,
    0
  );

  const totalTables = datasources.reduce(
    (acc, ds) => acc + ds.tables.length,
    0
  );

  return {
    datasources,
    worksheets,
    dashboards,
    summary: {
      totalDatasources: datasources.length,
      totalTables,
      totalCalculatedFields,
      totalColumns,
      totalDashboards: dashboards.length,
      totalWorksheets: worksheets.length,
    },
  };
}

function parseRelations(
  relation: any,
  discoveredTables: Set<string>,
  joins: Datasource["joins"]
) {
  if (!relation) return;

  const rels = Array.isArray(relation) ? relation : [relation];
  for (const rel of rels) {
    if (rel.type === "join") {
      const leftTable = rel.relation?.[0]?.table || rel.relation?.[0]?.name || "";
      const rightTable = rel.relation?.[1]?.table || rel.relation?.[1]?.name || "";
      if (leftTable) discoveredTables.add(leftTable.replace(/[\[\]]/g, ""));
      if (rightTable) discoveredTables.add(rightTable.replace(/[\[\]]/g, ""));

      joins.push({
        left: leftTable.replace(/[\[\]]/g, ""),
        right: rightTable.replace(/[\[\]]/g, ""),
        condition: rel.join || "inner",
      });

      // Recurse into nested relations
      if (rel.relation) {
        for (const subRel of Array.isArray(rel.relation) ? rel.relation : [rel.relation]) {
          if (subRel.type === "join" || subRel.relation) {
            parseRelations(subRel, discoveredTables, joins);
          } else if (subRel.type === "table" && subRel.table) {
            discoveredTables.add(subRel.table.replace(/[\[\]]/g, ""));
          }
        }
      }
    } else if (rel.type === "table" && rel.table) {
      discoveredTables.add(rel.table.replace(/[\[\]]/g, ""));
    }
  }
}

function extractWorksheetNames(zones: any, wsUsed: string[]) {
  if (!zones) return;
  const zoneArr = Array.isArray(zones) ? zones : [zones];
  for (const zone of zoneArr) {
    if (zone.name && !zone.name.startsWith("tbl")) {
      const name = zone.name;
      if (!name.includes("Dashboard") && name.length > 0) {
        wsUsed.push(name);
      }
    }
    if (zone.zone) {
      extractWorksheetNames(zone.zone, wsUsed);
    }
  }
}

function cleanDashboardName(name: string): string {
  return name.replace(/^Dashboard \d+:\s*/, "").trim() || name;
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#13;&#10;/g, "\n")
    .replace(/&#13;/g, "\r")
    .replace(/&#10;/g, "\n");
}
