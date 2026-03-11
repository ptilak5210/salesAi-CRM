-- Add status column to whatsapp_messages for delivery tracking
ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'received';

-- Create index for message_id lookups (for status updates)
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_message_id
ON public.whatsapp_messages (user_id, message_id)
WHERE message_id IS NOT NULL;
