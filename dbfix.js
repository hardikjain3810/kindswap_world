const { Client } = require('pg');
const fs = require('fs');
const creds = JSON.parse(fs.readFileSync('/mnt/secrets/db-credentials', 'utf8'));
const client = new Client({host: creds.host, port: creds.port, database: creds.dbname, user: creds.username, password: creds.password});
client.connect().then(() => {
  console.log('Connected');
  return client.query("DELETE FROM typeorm_metadata WHERE name = 'ChangeAdminPermissionsToArray1739356400000'");
}).then(r => {
  console.log('Deleted rows:', r.rowCount);
  return client.query('ALTER TABLE admins ALTER COLUMN permissions DROP DEFAULT');
}).then(() => {
  console.log('Dropped DEFAULT');
  return client.end();
}).then(() => console.log('Done')).catch(e => { console.error('Error:', e.message); client.end(); });
