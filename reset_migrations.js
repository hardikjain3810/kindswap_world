const pg = require('/app/node_modules/pg');
const client = new pg.Client({
  host: 'kindswap-prod.cov8e4myuic2.us-east-1.rds.amazonaws.com',
  port: 5432,
  database: 'kindswap_production',
  user: 'kindswap_admin',
  password: 'KindSwapProd2026SecurePass32Chr',
  ssl: { rejectUnauthorized: false }
});
client.connect()
  .then(() => {
    console.log('Connected to production DB');
    return client.query('DROP TABLE IF EXISTS migrations CASCADE');
  })
  .then(() => {
    console.log('Dropped migrations table');
    return client.end();
  })
  .then(() => console.log('DONE - database reset complete'))
  .catch(e => {
    console.error('FAILED:', e.message);
    process.exit(1);
  });
