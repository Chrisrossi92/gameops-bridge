import { spawn, type ChildProcessByStdio } from 'node:child_process';
import type { Readable } from 'node:stream';
import { createInterface } from 'node:readline';

interface JournalStreamOptions {
  onLine: (line: string) => Promise<void> | void;
}

export function startValheimJournalStream(options: JournalStreamOptions): ChildProcessByStdio<null, Readable, Readable> {
  console.log('Starting valheim-journal stream: journalctl -u valheim -f -n 0 -o cat');

  const child = spawn('journalctl', ['-u', 'valheim', '-f', '-n', '0', '-o', 'cat'], {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => {
    const message = chunk.trim();

    if (message) {
      console.warn(`[valheim-journal] stderr: ${message}`);
    }
  });

  const lineReader = createInterface({ input: child.stdout });

  lineReader.on('line', (line) => {
    void Promise.resolve(options.onLine(line)).catch((error) => {
      console.error('Journal line handler failed', error);
    });
  });

  child.on('close', (code, signal) => {
    console.warn(`valheim-journal stream exited (code=${code ?? 'null'}, signal=${signal ?? 'null'})`);
  });

  child.on('error', (error) => {
    console.error('Failed to start valheim-journal stream', error);
  });

  return child;
}
