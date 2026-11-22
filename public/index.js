import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default function handler(req, res) {
  const filePath = path.join(__dirname, 'index.html');
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(fs.readFileSync(filePath, 'utf8'));
  }
  res.setHeader('Content-Type', 'text/plain');
  res.end('WhatsApp Super Bot Dashboard');
}
