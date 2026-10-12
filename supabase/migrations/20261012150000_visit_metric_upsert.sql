-- The app saves work quantities with an upsert (ON CONFLICT DO UPDATE), which rewrites
-- every column it sends. The key columns keep their values, the composite foreign key
-- keeps the company consistent, and visit_child_guard blocks moving a row to another visit.
grant update (company_id, visit_id, metric_id) on public.visit_metric to authenticated;
