-- Storage bucket for expense receipt images (private, 5 MB limit, images only)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'expense-receipts',
  'expense-receipts',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Users can upload receipts into their own folder
CREATE POLICY "expense_receipts_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'expense-receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can read their own receipts
CREATE POLICY "expense_receipts_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'expense-receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own receipts
CREATE POLICY "expense_receipts_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'expense-receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
