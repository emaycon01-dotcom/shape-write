UPDATE public.template_alignments
SET positions = (
  SELECT jsonb_agg(
    CASE WHEN p->>'id' = 'qr'
      THEN p || jsonb_build_object('x', 437, 'y', 118, 'w', 277, 'h', 277)
      ELSE p END
  )
  FROM jsonb_array_elements(positions) p
)
WHERE doc_type = 'cnh';