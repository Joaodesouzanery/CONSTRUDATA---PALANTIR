/**
 * xerParser.ts — Primavera P6 XER file parser.
 *
 * XER format (TAB-delimited text):
 *   %T TABLENAME          ← start of a table
 *   %F field1\tfield2...  ← field names
 *   %R value1\tvalue2...  ← one data row per line
 *   %E                    ← end of file (optional)
 *
 * Returns a map of tableName → array of row objects.
 */

export type XerTable = Record<string, string>[]
export type XerData = Record<string, XerTable>

export function parseXer(content: string): XerData {
  const result: XerData = {}
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')

  let currentTable = ''
  let fields: string[] = []

  for (const raw of lines) {
    const line = raw.trimEnd()
    if (!line) continue

    if (line.startsWith('%T')) {
      currentTable = line.slice(2).trim()
      fields = []
      result[currentTable] = []
    } else if (line.startsWith('%F')) {
      fields = line.slice(2).split('\t').map((f) => f.trim())
    } else if (line.startsWith('%R')) {
      if (!currentTable || fields.length === 0) continue
      const values = line.slice(2).split('\t')
      const row: Record<string, string> = {}
      fields.forEach((f, i) => {
        row[f] = values[i] ?? ''
      })
      result[currentTable].push(row)
    }
    // %E = end of file — ignore
  }

  return result
}

// ─── Typed extractors ────────────────────────────────────────────────────────

export interface XerTask {
  task_id: string
  proj_id: string
  wbs_id: string
  task_code: string       // Activity ID (e.g. EC1010)
  task_name: string
  phys_complete_pct: string
  target_drtn_hr_cnt: string   // original duration in hours
  remain_drtn_hr_cnt: string
  act_drtn_hr_cnt: string
  early_start_date: string
  early_end_date: string
  late_start_date: string
  late_end_date: string
  total_float_hr_cnt: string
  free_float_hr_cnt: string
  cstr_type: string
  cstr_date: string
  task_type: string     // TT_Mile = milestone
  clndr_id: string
}

export interface XerTaskPred {
  task_pred_id: string
  task_id: string
  pred_task_id: string
  pred_type: string     // PR_FS, PR_SS, PR_FF, PR_SF
  lag_hr_cnt: string
}

export interface XerWbs {
  wbs_id: string
  proj_id: string
  wbs_short_name: string
  wbs_name: string
  parent_wbs_id: string
}

export function extractTasks(data: XerData): XerTask[] {
  return (data['TASK'] ?? []) as unknown as XerTask[]
}

export function extractTaskPreds(data: XerData): XerTaskPred[] {
  return (data['TASKPRED'] ?? []) as unknown as XerTaskPred[]
}

export function extractWbs(data: XerData): XerWbs[] {
  return (data['PROJWBS'] ?? []) as unknown as XerWbs[]
}

// ─── Hours → Days helper ─────────────────────────────────────────────────────

const HOURS_PER_DAY = 8

export function hrsToDays(hrs: string | number): number {
  const h = typeof hrs === 'string' ? parseFloat(hrs) : hrs
  if (isNaN(h)) return 0
  return Math.round(h / HOURS_PER_DAY)
}

// ─── P6 date string → ISO date ───────────────────────────────────────────────

export function p6DateToIso(p6: string): string {
  // P6 dates: "2024-01-15 00:00" or "2024-01-15"
  if (!p6) return ''
  return p6.split(' ')[0]
}

// ─── Relationship type mapper ────────────────────────────────────────────────

export function mapRelType(p6Type: string): 'FS' | 'SS' | 'FF' | 'SF' {
  switch (p6Type) {
    case 'PR_SS': return 'SS'
    case 'PR_FF': return 'FF'
    case 'PR_SF': return 'SF'
    default:      return 'FS'
  }
}
