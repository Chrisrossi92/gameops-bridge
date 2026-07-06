import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const appSource = readFileSync(join(process.cwd(), 'apps/web/src/App.tsx'), 'utf8');
const serverAttentionSummarySource = readFileSync(
  join(process.cwd(), 'apps/web/src/server-attention-summary.tsx'),
  'utf8'
);
const contractSource = `${appSource}\n${serverAttentionSummarySource}`;

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
    'Player Directory',
    'Game-Specific Context',
    'Supporting Evidence',
    'Change Impact Summary',
    'Active Configuration',
    'Configuration Evidence',
    'Recovery Readiness Summary',
    'Recovery Actions / Existing Controls',
    'Backup History / Evidence',
    'Operator Timeline Summary',
    'Search / Exploration',
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
  assert.ok(overviewBlock.includes('currentActivity='));
  assert.ok(overviewBlock.includes('recommendedAction='));
  assert.ok(!overviewBlock.includes('Settings Control Center'));
  assert.ok(!overviewBlock.includes('Server Control Capability Map'));
  assert.ok(!overviewBlock.includes('Connector Status'));
  assert.ok(!overviewBlock.includes('Backup & Rollback Readiness'));
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
    'Player Directory',
    'Game-Specific Context',
    'Supporting Evidence'
  ].map((label) => valheimPlayerBlock.indexOf(label));
  assert.ok(valheimPlayersOrder.every((index) => index >= 0), 'Valheim Players hierarchy labels must exist.');
  assert.ok(valheimPlayersOrder[0] < valheimPlayersOrder[1]);
  assert.ok(valheimPlayersOrder[1] < valheimPlayersOrder[2]);
  assert.ok(valheimPlayersOrder[2] < valheimPlayersOrder[3]);
  assert.ok(valheimPlayerBlock.indexOf('title="Who is here right now?"') < valheimPlayerBlock.indexOf('title="Valheim characters"'));
  assert.ok(valheimPlayerBlock.indexOf('title="Valheim characters"') < valheimPlayerBlock.indexOf('title="Valheim player evidence"'));

  const palworldPlayersOrder = [
    'Player Activity Summary',
    'Player Directory',
    'Game-Specific Context',
    'Supporting Evidence'
  ].map((label) => palworldPlayerBlock.indexOf(label));
  assert.ok(palworldPlayersOrder.every((index) => index >= 0), 'Palworld Players hierarchy labels must exist.');
  assert.ok(palworldPlayersOrder[0] < palworldPlayersOrder[1]);
  assert.ok(palworldPlayersOrder[1] < palworldPlayersOrder[2]);
  assert.ok(palworldPlayersOrder[2] < palworldPlayersOrder[3]);
  assert.ok(palworldPlayerBlock.indexOf('title="Who is here right now?"') < palworldPlayerBlock.indexOf('title="Palworld guilds and bases"'));
  assert.ok(palworldPlayerBlock.indexOf('title="Palworld guilds and bases"') < palworldPlayerBlock.indexOf('title="Palworld player evidence"'));
});
