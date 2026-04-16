import * as Joi from 'joi';
import * as ipaddr from 'ipaddr.js';

const csvToArray = (value?: string) =>
  value
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean) ?? [];

const csvSchema = (
  validator: (value: string) => boolean,
  label: 'IP address' | 'CIDR'
) =>
  Joi.string()
    .allow('')
    .default('')
    .custom((value, helpers) => {
      const path = helpers.state.path?.join('.') ?? 'value';

      for (const item of csvToArray(value)) {
        if (!validator(item)) {
          return helpers.error('csv.invalid', {
            path,
            item,
            itemLabel: label
          });
        }
      }

      return value;
    })
    .messages({
      'csv.invalid': '{{#path}} contains an invalid {{#itemLabel}}: {{#item}}'
    });

const ipListSchema = csvSchema((value) => ipaddr.isValid(value), 'IP address');
const cidrListSchema = csvSchema((value) => {
  try {
    ipaddr.parseCIDR(value);
    return true;
  } catch {
    return false;
  }
}, 'CIDR');

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(4000),
  MONGODB_URI: Joi.string().uri().required(),
  AUTH_SECRET: Joi.string().min(16).required(),
  DEFAULT_TEAM_NAME: Joi.string().default('FocusTeam'),
  ALLOW_OPEN_REGISTRATION: Joi.boolean().truthy('true').falsy('false').default(true),
  ATTENDANCE_BALANCED_ACCOUNTING_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
  ALLOW_ANY_NETWORK: Joi.boolean().truthy('true').falsy('false').default(true),
  ALLOWED_PUBLIC_IPS: ipListSchema,
  ALLOWED_CIDRS: cidrListSchema,
  TRUST_PROXY: Joi.boolean().truthy('true').falsy('false').default(false),
  TRUSTED_PROXY_HOPS: Joi.number().min(1).default(1)
})
  .custom((value, helpers) => {
    const hasAllowedIps = csvToArray(value.ALLOWED_PUBLIC_IPS).length > 0;
    const hasAllowedCidrs = csvToArray(value.ALLOWED_CIDRS).length > 0;

    if (!value.ALLOW_ANY_NETWORK && !hasAllowedIps && !hasAllowedCidrs) {
      return helpers.error('network.allowlistRequired');
    }

    return value;
  })
  .messages({
    'network.allowlistRequired':
      'ALLOWED_PUBLIC_IPS or ALLOWED_CIDRS must be configured when ALLOW_ANY_NETWORK=false'
  });
