// PostgREST select strings, kept free of imports so supabase/tests/api.mjs can run them
// against a real PostgREST and catch errors the mocked e2e tests cannot.

// Relations are named by their foreign key: photo and comment also link a visit to its
// displays, so PostgREST would find two paths and reject an unnamed embed (400).
export const VISIT_SELECT = `
  id, company_id, workday_id, work_date, sort_order, task, source, added_by, resumed_from,
  work_status, review_status, arrived_at, consent, objection, retry_after, finished_at, notes,
  adder:person!visit_added_by_fkey (first_name),
  store:store!visit_company_id_store_id_fkey (id, name, address, area, customer_number, lat, lng, location_status),
  display:display!display_company_id_visit_id_fkey (id, display_type_id, reference, source, sort_order, deleted_at),
  photo:photo!photo_company_id_visit_id_fkey (id, kind, display_id, taken_at, uploaded_at, deleted_at)
`

// The supervisor's lists add who did the visit and when it was reviewed.
export const TEAM_VISIT_SELECT = `${VISIT_SELECT},
  merchandiser_id, reviewed_at, updated_at,
  merchandiser:person!visit_merchandiser_id_fkey (first_name, last_name)
`

export const COMMENT_SELECT = `
  id, visit_id, display_id, author_id, kind, body, created_at,
  author:person!comment_author_id_fkey (first_name, last_name)
`
