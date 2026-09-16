import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
export const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? 'postgresql://clc_app:clc_dev_password@localhost:5432/clc' });
