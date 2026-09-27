-- Insert the requested trails
INSERT INTO public.trails (name, difficulty, description, active, barangay, city)
VALUES
  (
    'Kumalisikis Trail', 
    'Easy–Moderate', 
    'A beginner-friendly trail with gradual elevation and scenic forest views. Suitable for first-time trekkers looking for a light to moderate challenge.',
    true,
    'N/A',
    'N/A'
  ),
  (
    'Mt. Mandalagan (Patag Trail)', 
    'Moderate', 
    'A moderately challenging trail featuring diverse terrain, including forests and sulfur vents. Ideal for trekkers with some hiking experience.',
    true,
    'Patag',
    'Silay City'
  ),
  (
    'Mt. Marapara (Canlandog Trail)', 
    'Hard', 
    'A difficult trail with steep ascents and rugged paths. Recommended for experienced trekkers seeking a physically demanding adventure.',
    true,
    'Canlandog',
    'Murcia'
  ),
  (
    'Mt. Silay (Cabatangan Trail)', 
    'Moderate–Hard', 
    'A challenging trail with long trekking hours, river crossings, and dense vegetation. Best suited for well-prepared hikers.',
    true,
    'Cabatangan',
    'Talisay City'
  );
