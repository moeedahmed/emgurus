-- Fix seeding categories to satisfy NOT NULL name column
INSERT INTO public.blog_categories (name, slug, title, description)
VALUES
  ('General','general','General','General updates and broad topics'),
  ('Exam Guidance','exam-guidance','Exam Guidance','Preparation and strategies for EM exams'),
  ('Clinical Compendium','clinical-compendium','Clinical Compendium','Clinical pearls and case-based learning'),
  ('Research & Evidence','research-evidence','Research & Evidence','Summaries and discussion of evidence'),
  ('Careers','careers','Careers','Training, jobs, and professional growth'),
  ('Announcements','announcements','Announcements','Platform and community announcements')
ON CONFLICT (slug) DO UPDATE SET title=EXCLUDED.title, name=EXCLUDED.title;