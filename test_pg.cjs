const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:Ms277353@db.jsywhjgjdhgrdciymhil.supabase.co:5432/postgres'
});

async function run() {
  try {
    await client.connect();
    console.log("Connected to Supabase!");
    const res = await client.query('SELECT NOW()');
    console.log("Time:", res.rows[0]);
    await client.end();
  } catch(e) {
    console.error("Error:", e.message);
    process.exit(1);
  }
}
run();
