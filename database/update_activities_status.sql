-- Add status column to activities table
ALTER TABLE public.activities
ADD COLUMN status TEXT NOT NULL DEFAULT 'confirmed' 
CHECK (status IN ('pending', 'confirmed', 'cancelled'));

-- Optional: If we want to simulate an AI pending request, we can insert one manually here for testing
-- INSERT INTO public.activities (user_id, title, attendee, date, time, type, status)
-- VALUES ('YOUR-USER-ID-HERE', 'AI Consultation setup', 'John Doe', 'Mar 15, 2026', '2:00 PM', 'Google Meet', 'pending');
