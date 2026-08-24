-- Migration: Add numero_interno (correlative) column to checklist_bms
-- Run this in Supabase SQL Editor

BEGIN;

-- Add the numero_interno column
ALTER TABLE checklist_bms 
ADD COLUMN IF NOT EXISTS numero_interno TEXT;

-- Create an index for faster lookups when generating the next correlative
CREATE INDEX IF NOT EXISTS idx_checklist_bms_numero_interno 
ON checklist_bms(empresa_id, tipo, numero_interno);

COMMIT;