-- Add position and employer tag columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN position_tags text[] DEFAULT '{}',
ADD COLUMN employer_tags text[] DEFAULT '{}';