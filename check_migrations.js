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
    return client.query('SELECT * FROM migrations');
  })
  .then(r => {
    console.log('Migrations table contents:');
    r.rows.forEach(row => console.log(JSON.stringify(row)));
    return client.end();
  })
  .catch(e => {
    console.error('ERROR:', e.message);
    process.exit(1);
  });
