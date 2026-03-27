const pg = require('/app/node_modules/pg');
const client = new pg.Client({
  host: 'kindswap-prod.cov8e4myuic2.us-east-1.rds.amazonaws.com',
  port: 5432,
  database: 'kindswap_production',
  user: 'kindswap_admin',
  password: 'KindSwapProd2026SecurePass32Chr'
});
client.connect()
  .then(() => {
    console.log('Connected to production DB');
    return client.query("DELETE FROM typeorm_metadata WHERE name = 'ChangeAdminPermissionsToArray1739356400000'");
  })
  .then(r => {
    console.log('Deleted migration record, rows affected:', r.rowCount);
    return client.query('ALTER TABLE admins ALTER COLUMN permissions DROP DEFAULT');
  })
  .then(() => {
    console.log('Dropped DEFAULT from permissions column');
    return client.end();
  })
  .then(() => console.log('DONE - database fix complete'))
  .catch(e => {
    console.error('FAILED:', e.message);
    process.exit(1);
  });
