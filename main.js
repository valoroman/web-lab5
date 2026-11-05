const { Command } = require('commander');
const http = require('node:http');
const { once } = require('node:events');
const { mkdir, readFile, writeFile, rename, rm } = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const superagent = require('superagent');

async function saveImage(filePath, bytes) {
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;

  try {
    await writeFile(temporaryPath, bytes);
    await rename(temporaryPath, filePath);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

async function getImage(code, filePath) {
  try {
    return { bytes: await readFile(filePath), source: 'cache' };
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  const bytes = await downloadImage(code);
  if (bytes === null) {
    return null;
  }

  await saveImage(filePath, bytes);
  return { bytes, source: 'http.cat' };
}
async function downloadImage(code) {
  try {
    const result = await superagent
      .get(`https://http.cat/${code}`)
      .buffer(true)
      .timeout(8000);

    if (
      result.type !== 'image/jpeg' ||
      !Buffer.isBuffer(result.body) ||
      result.body.length === 0
    ) {
      return null;
    }

    return result.body;
  } catch {
    return null;
  }
}
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

  const allowedMethods = ['GET', 'PUT', 'DELETE'];

  const server = http.createServer(async (request, response) => {
    const headers = { 'Content-Type': 'text/plain; charset=utf-8' };

    if (!allowedMethods.includes(request.method)) {
      response.writeHead(405, { ...headers, Allow: allowedMethods.join(', ') });
      response.end('Method not allowed\n');
      return;
    }

    const pathname = request.url.split('?', 1)[0];
    const match = /^\/([1-5]\d{2})$/.exec(pathname);

       if (!match) {
      response.writeHead(404, headers);
      response.end('Expected a status code in the path, for example /418\n');
      return;
    }

    const code = match[1];
    const filePath = path.join(cacheDir, `${code}.jpg`);

    try {
      if (request.method === 'GET') {
        const image = await getImage(code, filePath);

        if (image !== null) {
          response.writeHead(200, {
            'Content-Type': 'image/jpeg',
            'Content-Length': image.bytes.length,
            'X-Cache-Source': image.source
          });
          response.end(image.bytes);
          return;
        }
      }

      response.writeHead(404, headers);
      response.end(`Image ${code} not found\n`);
    } catch (error) {
      console.error(`Cache error for ${code}: ${error.message}`);
      response.writeHead(500, headers);
      response.end('Could not read or save the image\n');
    }
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
