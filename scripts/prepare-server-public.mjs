import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const clientDistDir = path.resolve(__dirname, '../client/dist');
const serverPublicDir = path.resolve(__dirname, '../server/public');

await rm(serverPublicDir, { recursive: true, force: true });
await mkdir(serverPublicDir, { recursive: true });
await cp(clientDistDir, serverPublicDir, { recursive: true });
