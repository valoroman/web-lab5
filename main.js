const { Command } = require('commander');
const http = require('node:http');
const { once } = require('node:events');
const { mkdir } = require('node:fs/promises');
const path = require('node:path');

async function main() {
  const program = new Command();

  program
    .helpOption('--help', 'Show help')
    .requiredOption('-h, --host <address>', 'Server address')
    .requiredOption('-p, --port <number>', 'Server port')
    .requiredOption('-c, --cache <path>', 'Cache directory')
    .parse();

  const { host, port, cache } = program.opts();
  const portNumber = Number(port);

  if (!/^\d+$/.test(port) || portNumber < 1 || portNumber > 65535) {
    console.error('Port must be a whole number from 1 to 65535.');
    process.exitCode = 1;
    return;
  }

  const cacheDir = path.resolve(cache);

  try {
    await mkdir(cacheDir, { recursive: true });
  } catch (error) {
    console.error(`Could not create cache directory: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const server = http.createServer(async (_request, response) => {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found\n');
  });

  try {
    server.listen(portNumber, host);
    await once(server, 'listening');
    console.log(`Server listening on ${host}, port ${portNumber}`);
    console.log(`Cache directory: ${cacheDir}`);
  } catch (error) {
    console.error(`Could not start server: ${error.message}`);
    process.exitCode = 1;
  }
}

main();
