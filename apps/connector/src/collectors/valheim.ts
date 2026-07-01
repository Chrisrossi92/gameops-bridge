import { readFile } from 'node:fs/promises';
import type { NormalizedEvent } from '@gameops/shared';
import { readValheimJournalRecentLines } from '../adapters/valheim/journal.js';
import { valheimAdapter } from '../adapters/valheim/parser.js';
import { BaseCollector } from './base.js';
import type { CollectorConfiguration } from './types.js';

export class ValheimCollector extends BaseCollector {
  private processedLineCount = 0;

  public constructor(configuration: CollectorConfiguration) {
    super({
      collectorId: `valheim:${configuration.serverId}:${configuration.mode}`,
      name: configuration.label ?? 'Valheim Collector',
      game: 'valheim',
      configuration
    });
  }

  public parseLine(line: string): NormalizedEvent | null {
    return valheimAdapter.parseLine(line, { serverId: this.configuration.serverId });
  }

  public collectLines(lines: string[]): NormalizedEvent[] {
    return lines
      .map((line) => this.parseLine(line))
      .filter((event): event is NormalizedEvent => event !== null);
  }

  public async collect(): Promise<NormalizedEvent[]> {
    if (this.configuration.mode !== 'file') {
      return [];
    }

    if (!this.configuration.logFile) {
      throw new Error('Valheim file collector requires configuration.logFile.');
    }

    const content = await readFile(this.configuration.logFile, 'utf8');
    const allLines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (this.processedLineCount > allLines.length) {
      this.processedLineCount = 0;
    }

    const newLines = allLines.slice(this.processedLineCount);
    this.processedLineCount = allLines.length;

    return this.collectLines(newLines);
  }

  public async collectBackfillLines(lineCount: number): Promise<NormalizedEvent[]> {
    const safeLineCount = Math.max(0, Math.floor(lineCount));

    if (safeLineCount <= 0) {
      return [];
    }

    if (this.configuration.mode === 'file') {
      if (!this.configuration.logFile) {
        throw new Error('Valheim file collector backfill requires configuration.logFile.');
      }

      const content = await readFile(this.configuration.logFile, 'utf8');
      const allLines = content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      const tailLines = allLines.slice(Math.max(0, allLines.length - safeLineCount));

      this.processedLineCount = Math.max(0, allLines.length - tailLines.length);

      return this.collectLines(tailLines);
    }

    if (this.configuration.mode === 'journal') {
      const lines = await readValheimJournalRecentLines({
        serviceName: this.configuration.journalServiceName,
        lineCount: safeLineCount
      });

      return this.collectLines(lines);
    }

    return [];
  }

  public collectJournalLine(line: string): NormalizedEvent[] {
    const event = this.parseLine(line);
    return event ? [event] : [];
  }

  public resetForTests(): void {
    this.processedLineCount = 0;
  }
}

export class ValheimJournalCollector extends ValheimCollector {
  public override async collect(): Promise<NormalizedEvent[]> {
    return [];
  }
}
