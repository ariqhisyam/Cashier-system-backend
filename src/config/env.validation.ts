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
  SUPABASE_KEY: Joi.string().allow('').optional().default(''),
  SUPABASE_STORAGE_BUCKET: Joi.string().default('Cashier-system-img'),
  ALLOWED_ORIGINS: Joi.string().default('http://localhost:3000'),
  THROTTLE_TTL: Joi.number().default(60000), // 1 minute window
  THROTTLE_LIMIT: Joi.number().default(100), // 100 requests per minute
});
