module.exports = ({ env }) => ({
    connection: {
      client: 'postgres',
      connection: {
        host: env('POSTGRES_HOST', 'strapiDB_deeprecall'), // Container name for the PostgreSQL service
        port: env.int('POSTGRES_PORT', 5432),
        database: env('POSTGRES_NAME', 'main'),
        user: env('POSTGRES_USER', 'renlephy'),
        password: env('POSTGRES_PASSWORD', 'password'),
        ssl: env.bool('POSTGRES_SSL', false),
      },
    },
  });
  