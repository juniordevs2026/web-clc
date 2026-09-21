DO $$
DECLARE
  class_row RECORD;
  subject_row RECORD;
  base_class TEXT;
  subject_name TEXT;
  subject_slot TEXT;
BEGIN
  FOR class_row IN
    SELECT DISTINCT regexp_replace(nama_kelas, ' [12]$', '') AS nama_kelas
    FROM kelas
    WHERE nama_kelas ~ ' [12]$'
  LOOP
    base_class := class_row.nama_kelas;

    INSERT INTO kelas (nama_kelas)
    VALUES (base_class)
    ON CONFLICT (nama_kelas) DO NOTHING;

    UPDATE users
    SET kelas = base_class
    WHERE kelas IN (base_class || ' 1', base_class || ' 2');

    FOR subject_row IN
      SELECT id, nama_pelajaran, kelas
      FROM mata_pelajaran
      WHERE kelas IN (base_class || ' 1', base_class || ' 2')
      ORDER BY CASE WHEN kelas = base_class || ' 1' THEN 1 ELSE 2 END, id
    LOOP
      subject_name := regexp_replace(subject_row.nama_pelajaran, ' [12]$', '');
      subject_slot := CASE WHEN subject_row.kelas = base_class || ' 1' THEN '1' ELSE '2' END;

      UPDATE mata_pelajaran
      SET nama_pelajaran = subject_name || ' ' || subject_slot,
          kelas = base_class
      WHERE id = subject_row.id;
    END LOOP;

    INSERT INTO mata_pelajaran (nama_pelajaran, deskripsi, guru_id, kapasitas, kelas)
    SELECT regexp_replace(mp.nama_pelajaran, ' 1$', ' 2'), mp.deskripsi, mp.guru_id, mp.kapasitas, base_class
    FROM mata_pelajaran mp
    WHERE mp.kelas = base_class
      AND mp.nama_pelajaran ~ ' 1$'
      AND NOT EXISTS (
        SELECT 1
        FROM mata_pelajaran duplicate
        WHERE duplicate.kelas = base_class
          AND duplicate.nama_pelajaran = regexp_replace(mp.nama_pelajaran, ' 1$', ' 2')
      );

    DELETE FROM kelas
    WHERE nama_kelas IN (base_class || ' 1', base_class || ' 2');
  END LOOP;
END
$$;
