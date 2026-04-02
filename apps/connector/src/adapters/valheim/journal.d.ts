import { type ChildProcessByStdio } from 'node:child_process';
import type { Readable } from 'node:stream';
interface JournalStreamOptions {
    onLine: (line: string) => Promise<void> | void;
}
export declare function startValheimJournalStream(options: JournalStreamOptions): ChildProcessByStdio<null, Readable, Readable>;
export {};
//# sourceMappingURL=journal.d.ts.map