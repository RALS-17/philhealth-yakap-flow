# Supabase setup — automatic flow monitoring

This app can log each **completed** pathway (when staff taps **New Patient** after END / Discharged) into a Supabase table. No patient name or PhilHealth number is stored.

## 1. Create a Supabase project

1. Open https://supabase.com and sign in  
2. **New project** → name e.g. `gcare-flow-monitor`  
3. Wait until the project is ready  

## 2. Create the table

In Supabase → **SQL Editor** → New query → paste and run:

```sql
create table if not exists public.flow_completions (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  flow_name text not null,
  branch text,
  entry_type text
);

-- Allow the web app to insert rows (anon key)
alter table public.flow_completions enable row level security;

create policy "Allow public insert for flow completions"
  on public.flow_completions
  for insert
  to anon
  with check (true);

-- Optional: allow reading counts from the same app later
create policy "Allow public read for flow completions"
  on public.flow_completions
  for select
  to anon
  using (true);
```

## 3. Copy API keys into the app

1. Supabase → **Project Settings** → **API**  
2. Copy **Project URL** and **anon public** key  
3. In the project folder, create a file named `.env`:

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

4. Restart the dev server (`npm run dev`) so Vite loads the env vars  

## 4. Install dependency (once)

```bash
npm install @supabase/supabase-js
```

## 5. How logging works

- When a flow reaches **END / Discharged** and staff clicks the primary **New Patient** button, the app inserts one row.  
- Mid-flow **New Patient** (outline button) only resets the guide and does **not** log.  
- If `.env` is missing, the app still works; logging is skipped.

## 6. View counts

In Supabase → **Table Editor** → `flow_completions`, or SQL:

```sql
select flow_name, count(*) as total
from public.flow_completions
group by flow_name
order by total desc;

select date(created_at) as day, count(*) as total
from public.flow_completions
group by 1
order by 1 desc;
```

## 7. Deploy note (GitHub Pages)

Add the same `VITE_SUPABASE_*` values in your host/CI build env so production builds can log too.
