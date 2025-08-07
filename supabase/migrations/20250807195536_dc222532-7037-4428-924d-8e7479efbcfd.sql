-- Add RCEM-specific exam types
ALTER TYPE public.exam_type ADD VALUE 'MRCEM_PRIMARY';
ALTER TYPE public.exam_type ADD VALUE 'MRCEM_SBA';  
ALTER TYPE public.exam_type ADD VALUE 'FRCEM_SBA';