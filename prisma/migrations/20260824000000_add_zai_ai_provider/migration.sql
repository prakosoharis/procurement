-- Additive: registers z.ai as an AI provider so AiUsage and AiEvent can record
-- its calls under their own value. Recording them as OPENAI would corrupt the
-- per-provider cost and latency history.
--
-- PostgreSQL allows ALTER TYPE ... ADD VALUE inside a transaction from 12
-- onwards provided the new value is not used in the same transaction, which is
-- the case here. No existing row changes.
ALTER TYPE "AiProvider" ADD VALUE IF NOT EXISTS 'ZAI';
