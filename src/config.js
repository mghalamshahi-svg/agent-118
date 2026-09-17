require('dotenv').config();

function required(name, fallback = undefined) {
  const v = process.env[name] ?? fallback;
  return v;
}

module.exports = {
  port: parseInt(process.env.PORT || '3300', 10),

  wp: {
    baseUrl: required('WP_BASE_URL', ''),
    serviceKey: required('WP_SERVICE_KEY', ''), // preferred — see wpClient.js
    username: required('WP_APP_USERNAME', ''), // fallback if Application Passwords are available
    password: required('WP_APP_PASSWORD', ''),
  },

  stt: {
    provider: required('STT_PROVIDER', 'openai'),
    openaiApiKey: required('OPENAI_API_KEY', ''),
  },

  nlu: {
    provider: required('NLU_PROVIDER', 'anthropic'),
    model: required('NLU_MODEL', 'claude-sonnet-4-5'),
    anthropicApiKey: required('ANTHROPIC_API_KEY', ''),
    openaiApiKey: required('OPENAI_API_KEY', ''),
  },

  corsOrigins: (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};
