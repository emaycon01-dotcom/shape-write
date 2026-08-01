UPDATE public.template_alignments
SET positions = (
  SELECT jsonb_agg(
    CASE p->>'id'
      WHEN 'reitor'     THEN p || '{"x":1032,"y":663}'::jsonb
      WHEN 'secretario' THEN p || '{"x":958,"y":1309}'::jsonb
      WHEN 'resolucao'  THEN p || '{"x":958,"y":1343}'::jsonb
      WHEN 'serial'     THEN p || '{"x":1144,"y":1636}'::jsonb
      ELSE p
    END ORDER BY ord
  )
  FROM jsonb_array_elements(positions) WITH ORDINALITY AS t(p, ord)
)
WHERE doc_type = 'diploma';