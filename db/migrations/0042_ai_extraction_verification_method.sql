begin;

-- Add 'ai_extraction' to the verification_method enum so the inventory cron
-- can record AI Gateway extraction results on offers and price history.
-- The AI extraction fallback runs at confidence 50 (1-day freshness window)
-- and is gated by INVENTORY_AI_EXTRACTION=true.

alter type verification_method add value if not exists 'ai_extraction';

commit;
