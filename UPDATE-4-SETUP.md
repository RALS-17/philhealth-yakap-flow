# Update 4 — Date range filter + Daily census comparison

No database or Supabase changes. Only copy the files, then restart `npm run dev`.

Files: `src/BenefitsDashboard.tsx`, `src/AdminCharts.tsx`, `src/index.css`, `src/lib/benefitsMetrics.ts`
(copy each into the same folder in your project and click Replace).

## What changed
- The date filter (Dashboard, Insights, Patient List) now has: All months, Last 7 days, Last 30 days, Custom range… (pick From and To dates), and each month.
- Every number on the page follows the chosen dates.
- Daily census shows a dashed orange line for the previous period (previous month, or the same number of days right before your range). Tick/untick "Compare" to show or hide it. Hover a day to see both values.
- "Total census" compares with "last month" or "previous period".
- Custom ranges are limited to 1 year.
