import { app } from './app.js';
import { pool } from './config/database.js';
const port=Number(process.env.PORT || 5000);
const server=app.listen(port,process.env.HOST || '127.0.0.1',()=>console.log(`RKR TOUR API: http://localhost:${port}`));
server.on('error', e=>{ console.error(`Server could not start: ${e.code}`); process.exitCode=1; });
for (const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>server.close(async()=>{await pool.end();process.exit(0);}));
