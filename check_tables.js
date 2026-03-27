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
    return client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`);
  })
  .then(r => {
    console.log('Tables:', r.rows.map(x=>x.table_name).join(','));
    return client.end();
  })
  .catch(e => {
    console.error('ERROR:', e.message);
    process.exit(1);
  });
