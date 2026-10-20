-- =============================================================================
-- A new role: the seller (vendedor). Each store can have one; the activation
-- messages name them as "Responsable". On its own file: a new enum value can only
-- be used once this transaction is committed.
-- =============================================================================
alter type public.role add value if not exists 'seller' after 'merchandiser';
