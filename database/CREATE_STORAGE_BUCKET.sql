-- Create the 'whatsapp-media' bucket if it doesn't already exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-media', 'whatsapp-media', true)
ON CONFLICT (id) DO NOTHING;

-- Enable Public Access for fetching images via URL
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT
USING (bucket_id = 'whatsapp-media');

-- Enable Authenticated uploads (CRM Backend or Users)
CREATE POLICY "Authenticated Uploads" 
ON storage.objects FOR INSERT 
WITH CHECK (
    bucket_id = 'whatsapp-media' AND 
    auth.role() = 'authenticated'
);

-- Enable Backend/Admin full access (Since we manage auth server-side with supersonic client)
CREATE POLICY "Admin All Access" 
ON storage.objects FOR ALL
USING (bucket_id = 'whatsapp-media');
