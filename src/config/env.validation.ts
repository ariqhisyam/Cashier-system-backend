import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3001),
  DATABASE_URL: Joi.string().required().messages({
    'any.required': 'DATABASE_URL is required for Prisma database connection',
  }),
  DIRECT_URL: Joi.string().required().messages({
    'any.required': 'DIRECT_URL is required for Prisma migration and direct connection',
  }),
  SUPABASE_URL: Joi.string().uri().required().messages({
    'any.required': 'SUPABASE_URL is required for Supabase client',
  }),
  SUPABASE_STORAGE_BUCKET: Joi.string().default('Cashier-system-img'),
  S3_ENDPOINT: Joi.string().uri().optional().default('https://llyeovbymplgfalfxbrd.supabase.co/storage/v1/s3'),
  S3_REGION: Joi.string().optional().default('ap-northeast-2'),
  S3_ACCESS_KEY_ID: Joi.string().optional().allow(''),
  S3_SECRET_ACCESS_KEY: Joi.string().optional().allow(''),
  ALLOWED_ORIGINS: Joi.string().default('http://localhost:3000'),
  THROTTLE_TTL: Joi.number().default(60000), // 1 minute window
  THROTTLE_LIMIT: Joi.number().default(100), // 100 requests per minute
  JWT_SECRET: Joi.string().min(32).required().messages({
    'any.required': 'JWT_SECRET is required and must be specified in .env',
    'string.min': 'JWT_SECRET must be at least 32 characters long for cryptographic security',
  }),
  JWT_EXPIRES_IN: Joi.string().default('30d'),
  COOKIE_SAME_SITE: Joi.string().valid('lax', 'strict', 'none').default('lax'),
  COOKIE_SECURE: Joi.boolean().optional(),
  TELEGRAM_BOT_TOKEN: Joi.string().optional().allow(''),
  TELEGRAM_CHAT_ID: Joi.string().optional().allow(''),
});
