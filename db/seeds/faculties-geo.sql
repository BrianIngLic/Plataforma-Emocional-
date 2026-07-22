-- Seeds for faculties and campuses geographical data
BEGIN;

-- Faculty: Centro de Detección Biomolecular
INSERT INTO public.faculties (campus_id, name, virtual_tour_url, latitude, longitude, faculty_code)
VALUES (
  (SELECT id FROM public.campuses WHERE campus_code = 'CU' LIMIT 1),
  'Centro de Detección Biomolecular',
  'https://recorridosvirtuales.buap.mx/caeto/',
  18.9969573,
  -98.2029542,
  NULL
)
ON CONFLICT (name) DO UPDATE SET
  virtual_tour_url = COALESCE(EXCLUDED.virtual_tour_url, public.faculties.virtual_tour_url),
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  faculty_code = COALESCE(EXCLUDED.faculty_code, public.faculties.faculty_code);

-- Faculty: Facultad de Biología - BIO
INSERT INTO public.faculties (campus_id, name, virtual_tour_url, latitude, longitude, faculty_code)
VALUES (
  (SELECT id FROM public.campuses WHERE campus_code = 'CU' LIMIT 1),
  'Facultad de Biología',
  'https://recorridosvirtuales.buap.mx/biologia/',
  19.0010654,
  -98.2011704,
  'BIO'
)
ON CONFLICT (name) DO UPDATE SET
  virtual_tour_url = COALESCE(EXCLUDED.virtual_tour_url, public.faculties.virtual_tour_url),
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  faculty_code = COALESCE(EXCLUDED.faculty_code, public.faculties.faculty_code);

-- Faculty: Facultad de Ciencias Químicas - FCQ1-8
INSERT INTO public.faculties (campus_id, name, virtual_tour_url, latitude, longitude, faculty_code)
VALUES (
  (SELECT id FROM public.campuses WHERE campus_code = 'CU' LIMIT 1),
  'Facultad de Ciencias Químicas',
  'https://recorridosvirtuales.buap.mx/computacion/',
  19.0043283,
  -98.2043182,
  'FCQ'
)
ON CONFLICT (name) DO UPDATE SET
  virtual_tour_url = COALESCE(EXCLUDED.virtual_tour_url, public.faculties.virtual_tour_url),
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  faculty_code = COALESCE(EXCLUDED.faculty_code, public.faculties.faculty_code);

-- Faculty: Facultad de Ciencias Químicas - FCQ9-11
INSERT INTO public.faculties (campus_id, name, virtual_tour_url, latitude, longitude, faculty_code)
VALUES (
  (SELECT id FROM public.campuses WHERE campus_code = 'CU' LIMIT 1),
  'Facultad de Ciencias Químicas',
  'https://recorridosvirtuales.buap.mx/biologia/',
  19.0018929,
  -98.2007929,
  'FCQ'
)
ON CONFLICT (name) DO UPDATE SET
  virtual_tour_url = COALESCE(EXCLUDED.virtual_tour_url, public.faculties.virtual_tour_url),
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  faculty_code = COALESCE(EXCLUDED.faculty_code, public.faculties.faculty_code);

-- Faculty: Facultad de Cultura Física - FCF
INSERT INTO public.faculties (campus_id, name, virtual_tour_url, latitude, longitude, faculty_code)
VALUES (
  (SELECT id FROM public.campuses WHERE campus_code = 'CU' LIMIT 1),
  'Facultad de Cultura Física',
  'https://recorridosvirtuales.buap.mx/cultura-fisica/',
  19.0009641,
  -98.1950073,
  'FCF'
)
ON CONFLICT (name) DO UPDATE SET
  virtual_tour_url = COALESCE(EXCLUDED.virtual_tour_url, public.faculties.virtual_tour_url),
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  faculty_code = COALESCE(EXCLUDED.faculty_code, public.faculties.faculty_code);

-- Faculty: Facultad de Medicina Veterinaria y Zootecnia - MVZ
INSERT INTO public.faculties (campus_id, name, virtual_tour_url, latitude, longitude, faculty_code)
VALUES (
  (SELECT id FROM public.campuses WHERE campus_code = 'CU' LIMIT 1),
  'Facultad de Medicina Veterinaria y Zootecnia',
  'https://recorridosvirtuales.buap.mx/caeto/',
  18.9972889,
  -98.2029282,
  'MVZ'
)
ON CONFLICT (name) DO UPDATE SET
  virtual_tour_url = COALESCE(EXCLUDED.virtual_tour_url, public.faculties.virtual_tour_url),
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  faculty_code = COALESCE(EXCLUDED.faculty_code, public.faculties.faculty_code);

-- Faculty: Laboratorio de Innovación de Materiales Aplicados - LIMA1
INSERT INTO public.faculties (campus_id, name, virtual_tour_url, latitude, longitude, faculty_code)
VALUES (
  (SELECT id FROM public.campuses WHERE campus_code = 'CU' LIMIT 1),
  'Laboratorio de Innovación de Materiales Aplicados',
  NULL,
  18.9951744,
  -98.1999466,
  'LIMA1'
)
ON CONFLICT (name) DO UPDATE SET
  virtual_tour_url = COALESCE(EXCLUDED.virtual_tour_url, public.faculties.virtual_tour_url),
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  faculty_code = COALESCE(EXCLUDED.faculty_code, public.faculties.faculty_code);

-- Faculty: Facultad de Ciencias Políticas y Sociales - CPS
INSERT INTO public.faculties (campus_id, name, virtual_tour_url, latitude, longitude, faculty_code)
VALUES (
  (SELECT id FROM public.campuses WHERE campus_code = 'CU' LIMIT 1),
  'Facultad de Ciencias Políticas y Sociales',
  'https://recorridosvirtuales.buap.mx/derecho/',
  19.0017659,
  -98.1992545,
  'CPS'
)
ON CONFLICT (name) DO UPDATE SET
  virtual_tour_url = COALESCE(EXCLUDED.virtual_tour_url, public.faculties.virtual_tour_url),
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  faculty_code = COALESCE(EXCLUDED.faculty_code, public.faculties.faculty_code);

-- Faculty: Facultad de Derecho y Ciencias Sociales - DER
INSERT INTO public.faculties (campus_id, name, virtual_tour_url, latitude, longitude, faculty_code)
VALUES (
  (SELECT id FROM public.campuses WHERE campus_code = 'CU' LIMIT 1),
  'Facultad de Derecho y Ciencias Sociales',
  'https://recorridosvirtuales.buap.mx/derecho/',
  19.0025037,
  -98.1991006,
  'DER'
)
ON CONFLICT (name) DO UPDATE SET
  virtual_tour_url = COALESCE(EXCLUDED.virtual_tour_url, public.faculties.virtual_tour_url),
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  faculty_code = COALESCE(EXCLUDED.faculty_code, public.faculties.faculty_code);

-- Faculty: Facultad de Lenguas - LEN
INSERT INTO public.faculties (campus_id, name, virtual_tour_url, latitude, longitude, faculty_code)
VALUES (
  (SELECT id FROM public.campuses WHERE campus_code = 'CU' LIMIT 1),
  'Facultad de Lenguas',
  'https://recorridosvirtuales.buap.mx/caale/',
  19.0016306,
  -98.1965590,
  'LEN'
)
ON CONFLICT (name) DO UPDATE SET
  virtual_tour_url = COALESCE(EXCLUDED.virtual_tour_url, public.faculties.virtual_tour_url),
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  faculty_code = COALESCE(EXCLUDED.faculty_code, public.faculties.faculty_code);

-- Faculty: Facultad de Filosofía y Antropología - FIL
INSERT INTO public.faculties (campus_id, name, virtual_tour_url, latitude, longitude, faculty_code)
VALUES (
  (SELECT id FROM public.campuses WHERE campus_code = 'CU' LIMIT 1),
  'Facultad de Filosofía y Antropología',
  'https://recorridosvirtuales.buap.mx/stu/',
  18.9977743,
  -98.1953824,
  'FIL'
)
ON CONFLICT (name) DO UPDATE SET
  virtual_tour_url = COALESCE(EXCLUDED.virtual_tour_url, public.faculties.virtual_tour_url),
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  faculty_code = COALESCE(EXCLUDED.faculty_code, public.faculties.faculty_code);

-- Faculty: Facultad de Administración - ADM
INSERT INTO public.faculties (campus_id, name, virtual_tour_url, latitude, longitude, faculty_code)
VALUES (
  (SELECT id FROM public.campuses WHERE campus_code = 'CU' LIMIT 1),
  'Facultad de Administración',
  'https://recorridosvirtuales.buap.mx/administracion/',
  19.0023216,
  -98.2008146,
  'ADM'
)
ON CONFLICT (name) DO UPDATE SET
  virtual_tour_url = COALESCE(EXCLUDED.virtual_tour_url, public.faculties.virtual_tour_url),
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  faculty_code = COALESCE(EXCLUDED.faculty_code, public.faculties.faculty_code);

-- Faculty: Facultad de Contaduría Pública - FCP
INSERT INTO public.faculties (campus_id, name, virtual_tour_url, latitude, longitude, faculty_code)
VALUES (
  (SELECT id FROM public.campuses WHERE campus_code = 'CU' LIMIT 1),
  'Facultad de Contaduría Pública',
  'https://recorridosvirtuales.buap.mx/contaduria/',
  18.9995213,
  -98.2046471,
  'FCP'
)
ON CONFLICT (name) DO UPDATE SET
  virtual_tour_url = COALESCE(EXCLUDED.virtual_tour_url, public.faculties.virtual_tour_url),
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  faculty_code = COALESCE(EXCLUDED.faculty_code, public.faculties.faculty_code);

-- Faculty: Facultad de Economía - ECO
INSERT INTO public.faculties (campus_id, name, virtual_tour_url, latitude, longitude, faculty_code)
VALUES (
  (SELECT id FROM public.campuses WHERE campus_code = 'CU' LIMIT 1),
  'Facultad de Economía',
  'https://recorridosvirtuales.buap.mx/economia',
  19.0016213,
  -98.1975480,
  'ECO'
)
ON CONFLICT (name) DO UPDATE SET
  virtual_tour_url = COALESCE(EXCLUDED.virtual_tour_url, public.faculties.virtual_tour_url),
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  faculty_code = COALESCE(EXCLUDED.faculty_code, public.faculties.faculty_code);

-- Faculty: Facultad de Arquitectura - ARQ
INSERT INTO public.faculties (campus_id, name, virtual_tour_url, latitude, longitude, faculty_code)
VALUES (
  (SELECT id FROM public.campuses WHERE campus_code = 'CU' LIMIT 1),
  'Facultad de Arquitectura',
  'https://recorridosvirtuales.buap.mx/arquitectura',
  19.0028180,
  -98.2041030,
  'ARQ'
)
ON CONFLICT (name) DO UPDATE SET
  virtual_tour_url = COALESCE(EXCLUDED.virtual_tour_url, public.faculties.virtual_tour_url),
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  faculty_code = COALESCE(EXCLUDED.faculty_code, public.faculties.faculty_code);

-- Faculty: Facultad de Ciencias de la Computación - FCC
INSERT INTO public.faculties (campus_id, name, virtual_tour_url, latitude, longitude, faculty_code)
VALUES (
  (SELECT id FROM public.campuses WHERE campus_code = 'CU' LIMIT 1),
  'Facultad de Ciencias de la Computación',
  'https://recorridosvirtuales.buap.mx/computacion/',
  19.0051844,
  -98.2044187,
  'FCC'
)
ON CONFLICT (name) DO UPDATE SET
  virtual_tour_url = COALESCE(EXCLUDED.virtual_tour_url, public.faculties.virtual_tour_url),
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  faculty_code = COALESCE(EXCLUDED.faculty_code, public.faculties.faculty_code);

-- Faculty: Facultad de Ciencias de la Electrónica - FCE
INSERT INTO public.faculties (campus_id, name, virtual_tour_url, latitude, longitude, faculty_code)
VALUES (
  (SELECT id FROM public.campuses WHERE campus_code = 'CU' LIMIT 1),
  'Facultad de Ciencias de la Electrónica',
  'https://recorridosvirtuales.buap.mx/fisico-matematicas/',
  19.0030641,
  -98.2023097,
  'FCE'
)
ON CONFLICT (name) DO UPDATE SET
  virtual_tour_url = COALESCE(EXCLUDED.virtual_tour_url, public.faculties.virtual_tour_url),
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  faculty_code = COALESCE(EXCLUDED.faculty_code, public.faculties.faculty_code);

-- Faculty: Facultad de Ciencias de la Electrónica - FCE8
INSERT INTO public.faculties (campus_id, name, virtual_tour_url, latitude, longitude, faculty_code)
VALUES (
  (SELECT id FROM public.campuses WHERE campus_code = 'CU' LIMIT 1),
  'Facultad de Ciencias de la Electrónica',
  'https://recorridosvirtuales.buap.mx/fisico-matematicas/',
  18.9952800,
  -98.1992680,
  'FCE'
)
ON CONFLICT (name) DO UPDATE SET
  virtual_tour_url = COALESCE(EXCLUDED.virtual_tour_url, public.faculties.virtual_tour_url),
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  faculty_code = COALESCE(EXCLUDED.faculty_code, public.faculties.faculty_code);

-- Faculty: Facultad de Ciencias Físico-Matemáticas - FM
INSERT INTO public.faculties (campus_id, name, virtual_tour_url, latitude, longitude, faculty_code)
VALUES (
  (SELECT id FROM public.campuses WHERE campus_code = 'CU' LIMIT 1),
  'Facultad de Ciencias Físico-Matemáticas',
  'https://recorridosvirtuales.buap.mx/fisico-matematicas/',
  19.0024863,
  -98.2011711,
  'FM'
)
ON CONFLICT (name) DO UPDATE SET
  virtual_tour_url = COALESCE(EXCLUDED.virtual_tour_url, public.faculties.virtual_tour_url),
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  faculty_code = COALESCE(EXCLUDED.faculty_code, public.faculties.faculty_code);

-- Faculty: Facultad de Ingeniería - ING
INSERT INTO public.faculties (campus_id, name, virtual_tour_url, latitude, longitude, faculty_code)
VALUES (
  (SELECT id FROM public.campuses WHERE campus_code = 'CU' LIMIT 1),
  'Facultad de Ingeniería',
  'https://recorridosvirtuales.buap.mx/ingenieria/',
  19.0017103,
  -98.2028973,
  'ING'
)
ON CONFLICT (name) DO UPDATE SET
  virtual_tour_url = COALESCE(EXCLUDED.virtual_tour_url, public.faculties.virtual_tour_url),
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  faculty_code = COALESCE(EXCLUDED.faculty_code, public.faculties.faculty_code);

-- Faculty: Facultad de Ingeniería Química - FIQ
INSERT INTO public.faculties (campus_id, name, virtual_tour_url, latitude, longitude, faculty_code)
VALUES (
  (SELECT id FROM public.campuses WHERE campus_code = 'CU' LIMIT 1),
  'Facultad de Ingeniería Química',
  'https://recorridosvirtuales.buap.mx/ingenieria-quimica/',
  19.0036344,
  -98.2026770,
  'FIQ'
)
ON CONFLICT (name) DO UPDATE SET
  virtual_tour_url = COALESCE(EXCLUDED.virtual_tour_url, public.faculties.virtual_tour_url),
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  faculty_code = COALESCE(EXCLUDED.faculty_code, public.faculties.faculty_code);

COMMIT;
