-- =============================================================================
-- delete_athlete_complete(p_email text)
-- Fully removes an athlete and all related data across all tables.
-- Uses dynamic SQL to find tables with athlete_id / user_id columns.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.delete_athlete_complete(p_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_athlete_id  uuid;
  v_user_id     uuid;
  v_table       text;
  v_deleted     int := 0;
  v_total       int := 0;
BEGIN
  -- 1. Resolve athlete_id from athletes table
  SELECT id INTO v_athlete_id
  FROM public.athletes
  WHERE email = p_email;

  IF v_athlete_id IS NULL THEN
    RETURN 'No athlete found with email: ' || p_email;
  END IF;

  -- 2. Resolve user_id from auth.users
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = p_email;

  -- 3. Delete from all public tables that have an athlete_id column
  --    (excluding 'athletes' itself — we delete that last)
  FOR v_table IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'athlete_id'
      AND t.table_type = 'BASE TABLE'
      AND c.table_name <> 'athletes'
    ORDER BY c.table_name
  LOOP
    BEGIN
      EXECUTE format('DELETE FROM public.%I WHERE athlete_id = $1', v_table) USING v_athlete_id;
      GET DIAGNOSTICS v_deleted = ROW_COUNT;
      v_total := v_total + v_deleted;
      RAISE NOTICE 'Deleted % rows from %', v_deleted, v_table;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not delete from % (athlete_id): %', v_table, SQLERRM;
    END;
  END LOOP;

  -- 4. Delete from all public tables that have a user_id column
  --    (skip tables already handled above that also have athlete_id)
  IF v_user_id IS NOT NULL THEN
    FOR v_table IN
      SELECT c.table_name
      FROM information_schema.columns c
      JOIN information_schema.tables t
        ON t.table_schema = c.table_schema AND t.table_name = c.table_name
      WHERE c.table_schema = 'public'
        AND c.column_name = 'user_id'
        AND t.table_type = 'BASE TABLE'
        AND c.table_name NOT IN (
          SELECT c2.table_name
          FROM information_schema.columns c2
          WHERE c2.table_schema = 'public'
            AND c2.column_name = 'athlete_id'
        )
      ORDER BY c.table_name
    LOOP
      BEGIN
        EXECUTE format('DELETE FROM public.%I WHERE user_id = $1', v_table) USING v_user_id;
        GET DIAGNOSTICS v_deleted = ROW_COUNT;
        v_total := v_total + v_deleted;
        RAISE NOTICE 'Deleted % rows from % (user_id)', v_deleted, v_table;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not delete from % (user_id): %', v_table, SQLERRM;
      END;
    END LOOP;
  END IF;

  -- 5. Handle athlete_onboarding separately (FK to auth.users via athlete_id)
  --    This table uses athlete_id as a reference to auth.users.id, not athletes.id
  IF v_user_id IS NOT NULL THEN
    BEGIN
      DELETE FROM public.athlete_onboarding WHERE athlete_id = v_user_id;
      GET DIAGNOSTICS v_deleted = ROW_COUNT;
      v_total := v_total + v_deleted;
      RAISE NOTICE 'Deleted % rows from athlete_onboarding (user_id ref)', v_deleted;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not delete from athlete_onboarding (user_id ref): %', SQLERRM;
    END;
  END IF;

  -- 6. Delete the athlete record itself
  BEGIN
    DELETE FROM public.athletes WHERE id = v_athlete_id;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    v_total := v_total + v_deleted;
    RAISE NOTICE 'Deleted athlete record';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not delete athlete: %', SQLERRM;
  END;

  -- 7. Delete auth.users entry
  IF v_user_id IS NOT NULL THEN
    BEGIN
      DELETE FROM auth.users WHERE id = v_user_id;
      RAISE NOTICE 'Deleted auth.users record';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not delete auth.users: %', SQLERRM;
    END;
  END IF;

  RETURN format('Done. Deleted %s related rows for athlete %s (%s)', v_total, p_email, v_athlete_id);
END;
$$;

-- Grant execute to authenticated users (coaches)
GRANT EXECUTE ON FUNCTION public.delete_athlete_complete(text) TO authenticated;

-- Usage: SELECT delete_athlete_complete('athlete@example.com');
