import * as Joi from 'joi';

const csvToArray = (value?: string) =>
  value
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean) ?? [];

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(4000),
  MONGODB_URI: Joi.string().uri().required(),
  AUTH_SECRET: Joi.string().min(16).required(),
  DEFAULT_TEAM_NAME: Joi.string().default('FocusTeam'),
  ALLOW_OPEN_REGISTRATION: Joi.boolean().truthy('true').falsy('false').default(true),
  ALLOW_ANY_NETWORK: Joi.boolean().truthy('true').falsy('false').default(true),
  ALLOWED_PUBLIC_IPS: Joi.string().custom((value, helpers) => {
    const arr = csvToArray(value);
    helpers.state.ancestors[0].__ALLOWED_PUBLIC_IPS = arr;
    return value;
  }),
  ALLOWED_CIDRS: Joi.string().custom((value, helpers) => {
    const arr = csvToArray(value);
    helpers.state.ancestors[0].__ALLOWED_CIDRS = arr;
    return value;
  }),
  TRUST_PROXY: Joi.boolean().truthy('true').falsy('false').default(false),
  TRUSTED_PROXY_HOPS: Joi.number().min(1).default(1)
});
