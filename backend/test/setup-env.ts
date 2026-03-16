import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.test so E2E tests use a separate database (pixelbucks_test)
dotenv.config({ path: path.resolve(__dirname, '..', '.env.test') });
