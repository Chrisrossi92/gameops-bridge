import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const appSource = readFileSync(join(process.cwd(), 'apps/web/src/App.tsx'), 'utf8');
const serverAttentionSummarySource = readFileSync(
  join(process.cwd(), 'apps/web/src/server-attention-summary.tsx'),
  'utf8'
);
const worldEventRendererSource = readFileSync(
  join(process.cwd(), 'apps/web/src/world-event-renderer.tsx'),
  'utf8'
);
const appCssSource = readFileSync(join(process.cwd(), 'apps/web/src/App.css'), 'utf8');
const contractSource = `${appSource}\n${serverAttentionSummarySource}\n${worldEventRendererSource}\n${appCssSource}`;

function sourceBetween(start: string, end: string): string {
  const startIndex = appSource.indexOf(start);
  assert.notEqual(startIndex, -1, `Missing source start marker: ${start}`);

  const endIndex = appSource.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `Missing source end marker: ${end}`);

  return appSource.slice(startIndex, endIndex);
}

function sourceFromPreviousMarker(startBefore: string, anchor: string, end: string): string {
  const anchorIndex = appSource.indexOf(anchor);
  assert.notEqual(anchorIndex, -1, `Missing source anchor marker: ${anchor}`);

  const startIndex = appSource.lastIndexOf(startBefore, anchorIndex);
  assert.notEqual(startIndex, -1, `Missing source start marker before anchor: ${startBefore}`);

  const endIndex = appSource.indexOf(end, anchorIndex + anchor.length);
  assert.notEqual(endIndex, -1, `Missing source end marker: ${end}`);

  return appSource.slice(startIndex, endIndex);
}

test('server console exposes the focused tab contract with accessible tab semantics', () => {
  for (const label of ['Overview', 'Players', 'Settings', 'Backups', 'History', 'Capabilities']) {
    assert.ok(appSource.includes(`label: '${label}'`), `Missing server tab label: ${label}`);
  }

  assert.ok(appSource.includes('role="tablist"'));
  assert.ok(appSource.includes('role="tab"'));
  assert.ok(appSource.includes('aria-selected={selectedDashboardTab === tab.key}'));
  assert.ok(appSource.includes('aria-controls="server-detail-panel"'));
  assert.ok(appSource.includes("role={selectedServer && selectedServerSummary ? 'tabpanel' : undefined}"));
  assert.ok(appSource.includes('aria-labelledby={selectedServer && selectedServerSummary ? `server-tab-${selectedDashboardTab}` : undefined}'));
});

test('top-level navigation shell exposes route intent without unsupported screens', () => {
  for (const entry of [
    ['Overview', 'Is everything okay?', "status: 'live'"],
    ['Servers', 'Which server needs attention?', "status: 'live'"],
    ['Operations', 'What work is happening right now?', "status: 'live'"],
    ['Automation', 'What will happen automatically?', "status: 'planned'"],
    ['History', 'What happened across the operation?', "status: 'live'"],
    ['Administration', 'What can I configure or maintain?', "status: 'live'"]
  ]) {
    const [label, question, status] = entry;
    assert.ok(appSource.includes(`label: '${label}'`), `Missing top-level nav label: ${label}`);
    assert.ok(appSource.includes(`question: '${question}'`), `Missing top-level nav question: ${question}`);
    assert.ok(appSource.includes(status), `Missing top-level nav status for: ${label}`);
  }

  assert.ok(appSource.includes('aria-label="Top-level operations console areas"'));
  assert.ok(appSource.includes("aria-label={`${item.label}, ${item.status === 'live' ? 'live area' : 'planned area'}. ${item.question}`"));
  assert.ok(appSource.includes('plannedIntent?: string;'));
  assert.ok(appSource.includes('Planned for real schedules, rules, and templates when loaded automation data exists.'));
  assert.ok(appSource.includes('top-level-nav-planned-intent'));
  assert.ok(appSource.includes("const [activeTopLevelArea, setActiveTopLevelArea] = useState<TopLevelArea>('overview');"));
  assert.ok(appSource.includes("setActiveWorkspace('overview');"));
  assert.ok(appSource.includes("setActiveTopLevelArea('operations');"));
  assert.ok(appSource.includes("setActiveTopLevelArea('history');"));
  assert.ok(appSource.includes("setActiveTopLevelArea('administration');"));
  assert.ok(appSource.includes('What work is happening right now?'));
  assert.ok(appSource.includes('No current work detected'));
  assert.ok(appSource.includes('What happened across the operation?'));
  assert.ok(appSource.includes('Cross-operation history'));
  assert.ok(appSource.includes('Open server history'));
  assert.ok(appSource.includes("setSelectedDashboardTab('history');"));
  assert.ok(appSource.includes('What can I configure or maintain?'));
  assert.ok(appSource.includes('Administration reference'));
  assert.ok(appSource.includes('read-only reference'));
  assert.ok(appSource.includes('Detailed controls and evidence remain in each server Settings, Backups, and Capabilities tab.'));
  assert.ok(appSource.includes('Open settings'));
  assert.ok(appSource.includes('Open capabilities'));
  assert.ok(appSource.includes('pendingDashboardTabRef'));
  assert.ok(appSource.includes('pendingDashboardTab?.serverId === selectedServerId ? pendingDashboardTab.tab : '));
  assert.ok(appSource.includes("pendingDashboardTabRef.current = { serverId: item.server.id, tab: 'history' };"));
  assert.ok(appSource.includes("pendingDashboardTabRef.current = { serverId: item.server.id, tab: 'settings' };"));
  assert.ok(appSource.includes("pendingDashboardTabRef.current = { serverId: item.server.id, tab: 'capabilities' };"));
  assert.ok(appSource.includes("setSelectedDashboardTab('settings');"));
  assert.ok(appSource.includes("setSelectedDashboardTab('capabilities');"));
  assert.ok(appSource.includes('History should remain smaller than the server console') || appSource.includes('Server History tabs will show deeper evidence'));
  assert.ok(appSource.includes("if (item.key === 'servers')"));
  assert.ok(appSource.includes('if (!selectedServer)'));
  assert.ok(appSource.includes("aria-disabled={isUnavailable ? 'true' : undefined}"));
  assert.ok(!appSource.includes("setActiveWorkspace('operations'"));
  assert.ok(!appSource.includes("setActiveWorkspace('automation'"));
  assert.ok(!appSource.includes("setActiveWorkspace('history'"));
  assert.ok(!appSource.includes("setActiveWorkspace('administration'"));
  assert.ok(!appSource.includes("setActiveTopLevelArea('automation');"));
  assert.ok(!appSource.includes("if (item.key === 'automation')"));
});

test('server navigation treats the selected server as the primary object', () => {
  assert.ok(appSource.includes('const groupedServerNavigation = useMemo(() => {'));
  assert.ok(appSource.includes('aria-label="Fleet server navigation"'));
  assert.ok(appSource.includes('server-nav-game-group'));
  assert.ok(appSource.includes('server-nav-server-item'));
  assert.ok(appSource.includes('role="group"'));
  assert.ok(appSource.includes('aria-label={`${getGameLabel(group.game)} servers`}'));
  assert.ok(appSource.includes('aria-label={`${summary?.displayName ?? server.displayName}, ${getGameLabel(server.game)} server, ${summary?.state ?? '));
  assert.ok(appSource.includes("{isActiveServer ? 'Selected · ' : ''}"));
  assert.ok(appSource.includes("pendingDashboardTabRef.current = { serverId: server.id, tab: 'overview' };"));
  assert.ok(appSource.includes("setActiveWorkspace(server.game);"));
  assert.ok(appSource.includes('aria-label="Selected server context"'));
  assert.ok(appSource.includes('Connector: {selectedServerSummary.operationalStatus.connectorStatus}'));
  assert.ok(appSource.includes('Telemetry: {getTelemetryAvailabilityLabel(selectedServerSummary)}'));
  assert.ok(appSource.includes('Alerts: {selectedAlertCount}'));
  assert.ok(appSource.includes('Configured: {selectedServerSummary.operationalStatus.configured ? '));
  assert.ok(appSource.includes('servers: serverOptions.length'));
  assert.ok(!appSource.includes('selected-status-pill'));
});

test('server tabs expose the expected primary questions and hierarchy labels', () => {
  for (const question of [
    'Does this server need my attention?',
    'Who is here right now?',
    'What happens if I change this?',
    'Can I safely recover?',
    'What happened?',
    'What can this console know or do?'
  ]) {
    assert.ok(contractSource.includes(question), `Missing server tab question: ${question}`);
  }

  for (const label of [
    'Player Activity Summary',
    'Players to inspect',
    'Selected player detail',
    'Game-Specific Context',
    'Supporting Evidence',
    'Change Impact Summary',
    'Active Configuration',
    'Configuration Evidence',
    'Backup Health',
    'Latest Backup',
    'Backup History',
    'Backup Details',
    'Diagnostics',
    'Operator Timeline Summary',
    'Event Timeline',
    'Event Detail / Exploration',
    'Raw Diagnostics',
    'Console Coverage Summary',
    'Available Capability Areas',
    'Technical Evidence / Diagnostics'
  ]) {
    assert.ok(appSource.includes(label), `Missing hierarchy label: ${label}`);
  }
});

test('overview uses ServerAttentionSummary and excludes technical default content', () => {
  const overviewBlock = sourceBetween(
    "{selectedDashboardTab === 'overview' ? (",
    "{selectedDashboardTab === 'history'"
  );

  assert.ok(overviewBlock.includes('<ServerAttentionSummary'));
  assert.ok(overviewBlock.includes('Review Next'));
  assert.ok(overviewBlock.includes('Server review path'));
  assert.ok(overviewBlock.includes('Important server objects'));
  assert.ok(overviewBlock.includes('<span>Players</span>'));
  assert.ok(overviewBlock.includes('<span>Configuration</span>'));
  assert.ok(overviewBlock.includes('<span>Backups</span>'));
  assert.ok(overviewBlock.includes('<span>History</span>'));
  assert.ok(overviewBlock.includes('<span>Capabilities</span>'));
  assert.ok(overviewBlock.includes('<small>Who is here</small>'));
  assert.ok(overviewBlock.includes('<small>Readiness</small>'));
  assert.ok(overviewBlock.includes('<small>Recovery</small>'));
  assert.ok(overviewBlock.includes('<small>Recent events</small>'));
  assert.ok(overviewBlock.includes('<small>Coverage</small>'));
  assert.ok(overviewBlock.indexOf('<ServerAttentionSummary') < overviewBlock.indexOf('Server review path'));
  assert.ok(overviewBlock.indexOf('Server review path') < overviewBlock.indexOf('Important server objects'));
  assert.ok(overviewBlock.includes('currentActivity='));
  assert.ok(overviewBlock.includes('recommendedAction='));
  assert.ok(overviewBlock.includes("setSelectedDashboardTab('players')"));
  assert.ok(overviewBlock.includes("setSelectedDashboardTab('settings')"));
  assert.ok(overviewBlock.includes("setSelectedDashboardTab('backups')"));
  assert.ok(overviewBlock.includes("setSelectedDashboardTab('history')"));
  assert.ok(overviewBlock.includes("setSelectedDashboardTab('capabilities')"));
  assert.ok(!overviewBlock.includes('Settings Control Center'));
  assert.ok(!overviewBlock.includes('Server Control Capability Map'));
  assert.ok(!overviewBlock.includes('Connector Status'));
  assert.ok(!overviewBlock.includes('Backup & Rollback Readiness'));
  assert.ok(!overviewBlock.includes('restart'));
  assert.ok(!overviewBlock.includes('write'));
});

test('backups tab follows the GPS object template sequence', () => {
  const backupsBlock = sourceBetween(
    "{selectedDashboardTab === 'backups' ? (",
    '<section className="game-section">'
  );

  for (const label of [
    'Backup Health',
    'Am I protected?',
    'Review Next',
    'What should I review next?',
    'Backup review path',
    'Latest Backup',
    'Newest recovery point',
    'Backup History',
    'Backup history',
    'Backup Details',
    'Recovery evidence',
    'Diagnostics',
    'Recovery diagnostics'
  ]) {
    assert.ok(backupsBlock.includes(label), `Missing Backups object-template label: ${label}`);
  }

  assert.ok(backupsBlock.indexOf('Backup Health') < backupsBlock.indexOf('Review Next'));
  assert.ok(backupsBlock.indexOf('Review Next') < backupsBlock.indexOf('Latest Backup'));
  assert.ok(backupsBlock.indexOf('Latest Backup') < backupsBlock.indexOf('Backup History'));
  assert.ok(backupsBlock.indexOf('Backup History') < backupsBlock.indexOf('Backup Details'));
  assert.ok(backupsBlock.indexOf('Backup Details') < backupsBlock.indexOf('Diagnostics'));
  assert.ok(backupsBlock.includes('backup-health-strip'));
  assert.ok(backupsBlock.includes('<BackupLatestCard'));
  assert.ok(backupsBlock.includes('<BackupHistoryList'));
  assert.ok(backupsBlock.includes('<PalworldBackupReadinessPanel'));
  assert.ok(contractSource.includes('aria-label="Backup history list"'));
  assert.ok(contractSource.includes('No created backup history loaded'));
  assert.ok(backupsBlock.includes("setSelectedDashboardTab('overview')"));
  assert.ok(backupsBlock.includes("setSelectedDashboardTab('history')"));
  assert.ok(backupsBlock.includes("setSelectedDashboardTab('settings')"));
  assert.ok(backupsBlock.includes("setSelectedDashboardTab('capabilities')"));
  assert.ok(!backupsBlock.includes("setSelectedDashboardTab('players')"));
  assert.ok(!backupsBlock.includes('onCreateBackup'));
  assert.ok(!backupsBlock.includes('onRestore'));
});

test('history tab follows the GPS object template sequence', () => {
  const historyBlock = sourceBetween(
    "{selectedDashboardTab === 'history' && selectedHistorySummary ? (",
    "{selectedDashboardTab === 'capabilities' && selectedCapabilitySummary ? ("
  );

  for (const label of [
    'Operator Timeline Summary',
    'Review Next',
    'History review path',
    'Event Timeline',
    'Recent events',
    'Event Detail / Exploration',
    'Explore world memory',
    'Raw Diagnostics',
    'Activity record'
  ]) {
    assert.ok(historyBlock.includes(label), `Missing History object-template label: ${label}`);
  }

  assert.ok(historyBlock.indexOf('Operator Timeline Summary') < historyBlock.indexOf('Review Next'));
  assert.ok(historyBlock.indexOf('Review Next') < historyBlock.indexOf('Event Timeline'));
  assert.ok(historyBlock.indexOf('Event Timeline') < historyBlock.indexOf('Event Detail / Exploration'));
  assert.ok(historyBlock.indexOf('Event Detail / Exploration') < historyBlock.indexOf('Raw Diagnostics'));
  assert.ok(historyBlock.includes('<WorldHistoryTimeline'));
  assert.ok(historyBlock.includes('<WorldMemorySearch'));
  assert.ok(historyBlock.includes('<SessionTimelinePanel'));
  assert.ok(historyBlock.includes('<ActivityLogPanel'));
  assert.ok(historyBlock.includes("setSelectedDashboardTab('players')"));
  assert.ok(historyBlock.includes("setSelectedDashboardTab('settings')"));
  assert.ok(historyBlock.includes("setSelectedDashboardTab('overview')"));
  assert.ok(historyBlock.includes("setSelectedDashboardTab('backups')"));
  assert.ok(historyBlock.includes("setSelectedDashboardTab('capabilities')"));
  assert.ok(worldEventRendererSource.includes('world-event-preview-details'));
  assert.ok(worldEventRendererSource.includes('Event details'));
  assert.ok(worldEventRendererSource.indexOf('world-event-preview-time') < worldEventRendererSource.indexOf('world-event-preview-details'));
  assert.ok(!historyBlock.includes('restart'));
  assert.ok(!historyBlock.includes('write'));
});

test('Palworld-only readiness and control panels stay scoped to Palworld surfaces', () => {
  const settingsBlock = sourceBetween(
    "{selectedDashboardTab === 'settings' ? (",
    "{selectedDashboardTab === 'backups' ? ("
  );
  const valheimCapabilityBlock = sourceBetween(
    'title="Valheim capability areas"',
    'title="Valheim technical evidence"'
  );
  const palworldCapabilityBlock = sourceBetween(
    'title="Palworld capability areas"',
    'title="Palworld technical evidence"'
  );

  assert.ok(settingsBlock.includes("selectedServer.game === 'palworld' ? ("));
  assert.ok(settingsBlock.includes('<BoostPresetPanel'));
  assert.ok(settingsBlock.includes('<SettingsCapabilityPanel'));
  assert.ok(settingsBlock.includes('<ServerSettingsReferencePanel'));
  assert.ok(settingsBlock.includes('No Valheim setting controls are exposed here'));

  assert.ok(!valheimCapabilityBlock.includes('<PalworldControlCapabilityPanel'));
  assert.ok(!valheimCapabilityBlock.includes('<PalworldActivityConfidencePanel'));
  assert.ok(!valheimCapabilityBlock.includes('<PalworldRuntimeAuditPanel'));
  assert.ok(!valheimCapabilityBlock.includes('Palworld 1.0 readiness'));
  assert.ok(valheimCapabilityBlock.includes('<ServerSettingsReferencePanel'));

  assert.ok(palworldCapabilityBlock.includes('<PalworldActivityConfidencePanel'));
  assert.ok(palworldCapabilityBlock.includes('<PalworldControlCapabilityPanel'));
  assert.ok(palworldCapabilityBlock.includes('<SettingsCapabilityPanel'));
});

test('settings evidence uses an OX summary before detailed configuration evidence', () => {
  const settingsCapabilityBlock = sourceBetween(
    'function SettingsCapabilityPanel({',
    'interface ServerSettingsReferencePanelProps'
  );

  assert.ok(settingsCapabilityBlock.includes('<h2>Configuration Health</h2>'));
  assert.ok(settingsCapabilityBlock.includes('settings-primary-state-grid'));
  assert.ok(settingsCapabilityBlock.includes('Read state'));
  assert.ok(settingsCapabilityBlock.includes('Edit state'));
  assert.ok(settingsCapabilityBlock.includes('Candidates'));
  assert.ok(settingsCapabilityBlock.includes('Runtime'));
  assert.ok(settingsCapabilityBlock.includes('Review next'));
  assert.ok(settingsCapabilityBlock.includes('settings-disclosure-list'));

  for (const label of [
    'Read evidence',
    'Edit blockers',
    'Future route',
    'Runtime match',
    'Editable candidates',
    'Observed values',
    'Restart and rollback',
    'Safety notes'
  ]) {
    assert.ok(settingsCapabilityBlock.includes(label), `Missing settings detail disclosure: ${label}`);
  }

  assert.ok(settingsCapabilityBlock.indexOf('Read state') < settingsCapabilityBlock.indexOf('Read evidence'));
  assert.ok(settingsCapabilityBlock.indexOf('Edit state') < settingsCapabilityBlock.indexOf('Edit blockers'));
  assert.ok(settingsCapabilityBlock.indexOf('<h2>Configuration Health</h2>') < settingsCapabilityBlock.indexOf('Read evidence'));
  assert.ok(!settingsCapabilityBlock.includes('<h3>Can read settings</h3>'));
  assert.ok(!settingsCapabilityBlock.includes('<h3>Can safely edit</h3>'));
  assert.ok(!settingsCapabilityBlock.includes('<h3>Safest future route</h3>'));
  assert.ok(!settingsCapabilityBlock.includes('<h3>Config and REST match</h3>'));
  assert.ok(!settingsCapabilityBlock.includes('<h3>Safety warnings</h3>'));
  assert.ok(settingsCapabilityBlock.includes('No apply, write, restart, or schedule controls are exposed.'));
});

test('capabilities tab follows the GPS object template sequence', () => {
  const capabilitiesBlock = sourceBetween(
    "{selectedDashboardTab === 'capabilities' && selectedCapabilitySummary ? (",
    "{selectedDashboardTab === 'overview' ? ("
  );

  for (const label of [
    'Console Coverage Summary',
    'Review Next',
    'Capability review path',
    'Configuration evidence',
    'Player and identity coverage',
    'Timeline evidence',
    'Available Capability Areas',
    'Technical Evidence / Diagnostics'
  ]) {
    assert.ok(capabilitiesBlock.includes(label), `Missing capabilities object-template label: ${label}`);
  }

  assert.ok(capabilitiesBlock.indexOf('Console Coverage Summary') < capabilitiesBlock.indexOf('Review Next'));
  assert.ok(capabilitiesBlock.indexOf('Review Next') < capabilitiesBlock.indexOf('Available Capability Areas'));
  assert.ok(capabilitiesBlock.indexOf('Available Capability Areas') < capabilitiesBlock.indexOf('Technical Evidence / Diagnostics'));
  assert.ok(capabilitiesBlock.includes("setSelectedDashboardTab('settings')"));
  assert.ok(capabilitiesBlock.includes("setSelectedDashboardTab('players')"));
  assert.ok(capabilitiesBlock.includes("setSelectedDashboardTab('history')"));
  assert.ok(!capabilitiesBlock.includes('restart'));
  assert.ok(!capabilitiesBlock.includes('write'));
});

test('game-specific player context stays separated from live player activity', () => {
  const valheimPlayerBlock = sourceBetween(
    'eyebrow="Player Activity Summary"',
    'title="Valheim historical evidence"'
  );
  const palworldPlayerBlock = sourceFromPreviousMarker(
    'eyebrow="Player Activity Summary"',
    'description="Live Palworld player activity is kept separate from identity, save, and guild evidence."',
    'title="Palworld activity record"'
  );

  const valheimPlayersOrder = [
    'Player Activity Summary',
    '<PlayerObjectList',
    'Game-Specific Context',
    'Supporting Evidence'
  ].map((label) => valheimPlayerBlock.indexOf(label));
  assert.ok(valheimPlayersOrder.every((index) => index >= 0), 'Valheim Players hierarchy labels must exist.');
  assert.ok(valheimPlayersOrder[0] < valheimPlayersOrder[1]);
  assert.ok(valheimPlayersOrder[1] < valheimPlayersOrder[2]);
  assert.ok(valheimPlayersOrder[2] < valheimPlayersOrder[3]);
  assert.ok(valheimPlayerBlock.indexOf('title="Who is here right now?"') < valheimPlayerBlock.indexOf('title="Valheim characters"'));
  assert.ok(valheimPlayerBlock.indexOf('title="Valheim characters"') < valheimPlayerBlock.indexOf('title="Valheim diagnostics"'));
  assert.ok(contractSource.includes('aria-label="Player object list"'));
  assert.ok(contractSource.includes('aria-label="Selected player detail"'));
  assert.ok(contractSource.includes('<span className="summary-label">Player List</span>'));
  assert.ok(contractSource.includes('<h2>Players to inspect</h2>'));
  assert.ok(contractSource.includes('player-master-detail-layout'));
  assert.ok(contractSource.includes('player-object-list-scroll'));
  assert.ok(contractSource.includes('Player directory diagnostics'));

  const palworldPlayersOrder = [
    'Player Activity Summary',
    '<PlayerObjectList',
    'Game-Specific Context',
    'Supporting Evidence'
  ].map((label) => palworldPlayerBlock.indexOf(label));
  assert.ok(palworldPlayersOrder.every((index) => index >= 0), 'Palworld Players hierarchy labels must exist.');
  assert.ok(palworldPlayersOrder[0] < palworldPlayersOrder[1]);
  assert.ok(palworldPlayersOrder[1] < palworldPlayersOrder[2]);
  assert.ok(palworldPlayersOrder[2] < palworldPlayersOrder[3]);
  assert.ok(palworldPlayerBlock.indexOf('title="Who is here right now?"') < palworldPlayerBlock.indexOf('title="Palworld guilds and bases"'));
  assert.ok(palworldPlayerBlock.indexOf('title="Palworld guilds and bases"') < palworldPlayerBlock.indexOf('title="Palworld diagnostics"'));
  assert.ok(palworldPlayerBlock.includes('Player telemetry diagnostics'));
  assert.ok(palworldPlayerBlock.includes('Save-link review list'));
  assert.ok(contractSource.includes('aria-label="Guild object list"'));
  assert.ok(contractSource.includes('aria-label="Selected guild detail"'));
  assert.ok(contractSource.includes('guild-master-detail-layout'));
  assert.ok(!palworldPlayerBlock.includes('palworld-guild-grid'));
});

test('GPS console consistency keeps review paths navigational and diagnostics lower priority', () => {
  const overviewBlock = sourceBetween(
    "{selectedDashboardTab === 'overview' ? (",
    "{selectedDashboardTab === 'history'"
  );
  const backupsBlock = sourceBetween(
    "{selectedDashboardTab === 'backups' ? (",
    '<section className="game-section">'
  );
  const historyBlock = sourceBetween(
    "{selectedDashboardTab === 'history' && selectedHistorySummary ? (",
    "{selectedDashboardTab === 'capabilities' && selectedCapabilitySummary ? ("
  );
  const capabilitiesBlock = sourceBetween(
    "{selectedDashboardTab === 'capabilities' && selectedCapabilitySummary ? (",
    "{selectedDashboardTab === 'overview' ? ("
  );

  for (const block of [overviewBlock, backupsBlock, historyBlock, capabilitiesBlock]) {
    assert.ok(block.includes('Review Next') || block.includes('review path'), 'Expected a navigational review path.');
    assert.ok(!block.includes('onRestore'), 'Review paths must not expose restore controls.');
    assert.ok(!block.includes('onCreateBackup'), 'Review paths must not expose backup creation controls.');
    assert.ok(!block.includes('onWrite'), 'Review paths must not expose write controls.');
  }

  assert.ok(backupsBlock.indexOf('Backup Details') < backupsBlock.indexOf('Diagnostics'));
  assert.ok(historyBlock.indexOf('Event Detail / Exploration') < historyBlock.indexOf('Raw Diagnostics'));
  assert.ok(capabilitiesBlock.indexOf('Available Capability Areas') < capabilitiesBlock.indexOf('Technical Evidence / Diagnostics'));
  assert.ok(contractSource.includes('.backup-next-review-card .next-action-list button'));
  assert.ok(contractSource.includes('.history-next-review-card .next-action-list button'));
});

test('GPS overview presentation prevents compressed cards and summary overflow', () => {
  assert.ok(contractSource.includes('repeat(auto-fit, minmax(13rem, 1fr))'));
  assert.ok(contractSource.includes('repeat(auto-fit, minmax(14rem, 1fr))'));
  assert.ok(contractSource.includes('repeat(auto-fit, minmax(10.5rem, 1fr))'));
  assert.ok(contractSource.includes('overflow-wrap: anywhere;'));
  assert.ok(contractSource.includes('white-space: normal;'));
  assert.ok(contractSource.includes('flex-wrap: wrap;'));
});
