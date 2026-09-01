DO $$
DECLARE r record; seq text; mx bigint;
BEGIN
  FOR r IN
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
  LOOP
    seq := pg_get_serial_sequence('public.' || quote_ident(r.table_name), r.column_name);
    IF seq IS NOT NULL THEN
      EXECUTE format('SELECT coalesce(max(%I),0) FROM public.%I', r.column_name, r.table_name) INTO mx;
      PERFORM setval(seq, mx + 1, false);
    END IF;
  END LOOP;

  SELECT coalesce(max(prontuario::bigint), 0) INTO mx
  FROM public.pacientes
  WHERE prontuario ~ '^[0-9]+$';
  PERFORM setval('public.prontuario_seq', mx + 1, false);
END $$;