-- Delete the duplicate trails that were just inserted (if any)
DELETE FROM public.trails 
WHERE name IN (
  'Kumalisikis Trail', 
  'Mt. Mandalagan (Patag Trail)', 
  'Mt. Marapara (Canlandog Trail)', 
  'Mt. Silay (Cabatangan Trail)'
)
AND id NOT IN (
  -- Ensure we don't accidentally delete if they were the only ones
  SELECT id FROM public.trails ORDER BY created_at ASC LIMIT 4
);

-- Update the original trails with the new names and descriptions
UPDATE public.trails 
SET 
  name = 'Kumalisikis Trail',
  difficulty = 'Easy–Moderate',
  description = 'A beginner-friendly trail with gradual elevation and scenic forest views. Suitable for first-time trekkers looking for a light to moderate challenge.'
WHERE name = 'Kumaliskis Trail' OR name = 'Kumalisikis Trail';

UPDATE public.trails 
SET 
  name = 'Mt. Mandalagan (Patag Trail)',
  difficulty = 'Moderate',
  description = 'A moderately challenging trail featuring diverse terrain, including forests and sulfur vents. Ideal for trekkers with some hiking experience.'
WHERE name = 'Patag Trail' OR name = 'Mt. Mandalagan (Patag Trail)';

UPDATE public.trails 
SET 
  name = 'Mt. Marapara (Canlandog Trail)',
  difficulty = 'Hard',
  description = 'A difficult trail with steep ascents and rugged paths. Recommended for experienced trekkers seeking a physically demanding adventure.'
WHERE name = 'Canlandog Trail' OR name = 'Mt. Marapara (Canlandog Trail)';

UPDATE public.trails 
SET 
  name = 'Mt. Silay (Cabatangan Trail)',
  difficulty = 'Moderate–Hard',
  description = 'A challenging trail with long trekking hours, river crossings, and dense vegetation. Best suited for well-prepared hikers.'
WHERE name = 'Cabatangan Trail' OR name = 'Mt. Silay (Cabatangan Trail)';
