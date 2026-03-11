-- Remove NOT NULL constraints from whatsapp_credentials since Baileys (Unofficial API) doesn't use them
ALTER TABLE public.whatsapp_credentials ALTER COLUMN access_token DROP NOT NULL;
ALTER TABLE public.whatsapp_credentials ALTER COLUMN phone_number_id DROP NOT NULL;
ALTER TABLE public.whatsapp_credentials ALTER COLUMN waba_id DROP NOT NULL;
