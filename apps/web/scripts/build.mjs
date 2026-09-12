// Root .env configures the API for development. Keep web builds in production.
process.env.NODE_ENV = 'production';
const { build } = await import('vite');
await build();
