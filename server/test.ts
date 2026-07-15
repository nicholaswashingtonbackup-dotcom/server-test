import { loadServerConfig } from './config';
import { authManager } from './auth';
import { meetingManager } from './meetingManager';
import { connectionManager } from './connectionManager';

function runTests() {
  console.log('=============================================================');
  console.log('🧪 RUNNING EXOS AUTHORITY SERVER PHASE 1 SUITE');
  console.log('=============================================================');

  let passedCount = 0;
  let failedCount = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passedCount++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      failedCount++;
    }
  }

  // Test 1: Configuration Parsing
  try {
    const config = loadServerConfig();
    assert(config.meeting.max_humans === 5, 'Config loads max humans limit correctly (Default 5)');
    assert(config.server.host === '0.0.0.0', 'Config loads host configuration correctly');
  } catch (err: any) {
    assert(false, `Config load threw error: ${err.message}`);
  }

  // Test 2: Local Development Authentication Bypass
  try {
    const invalidUser = authManager.authenticateDev('Wrong Name', 'BANKAI1983', 'android');
    assert(!invalidUser.success, 'Fails with incorrect username credentials');

    const invalidPass = authManager.authenticateDev('Nicholas Washington', 'WRONG_PASS', 'android');
    assert(!invalidPass.success, 'Fails with incorrect password credentials');

    const validAuth = authManager.authenticateDev('Nicholas Washington', 'BANKAI1983', 'android');
    assert(validAuth.success && !!validAuth.token, 'Authenticates successfully with valid development credentials');
    assert(validAuth.session?.role === 'owner', 'Dev Chairperson receives authoritative Owner permissions');
  } catch (err: any) {
    assert(false, `Dev Auth threw error: ${err.message}`);
  }

  // Test 3: Meeting Capacity Enforcements (Max 5 humans)
  try {
    const meeting = meetingManager.createMeeting('Strategy Align Test', 'strategy', ['nova', 'astra']);
    assert(meeting.status === 'lobby', 'Created meeting initializes in lobby state');

    // Add 5 humans successfully
    for (let i = 1; i <= 5; i++) {
      const join = meetingManager.joinParticipant(meeting.id, {
        userId: `human-${i}`,
        name: `Executive Participant ${i}`,
        role: 'participant',
        clientType: 'tablet'
      });
      assert(join.success, `Joined human participant ${i}/5 successfully`);
    }

    // Try to add a 6th human - should be blocked by meetingManager
    const joinSixth = meetingManager.joinParticipant(meeting.id, {
      userId: 'human-6',
      name: 'Intruder User',
      role: 'observer',
      clientType: 'android'
    });
    assert(!joinSixth.success, 'Blocks 6th human participant from joining (Capacity limited strictly to 5)');
  } catch (err: any) {
    assert(false, `Capacity Enforcements threw error: ${err.message}`);
  }

  // Test 4: Device Connection & Presence Tracking
  try {
    const connId = 'test-conn-123';
    const conn = connectionManager.registerConnection(
      connId,
      'dev-nicholas-washington',
      'Nicholas Washington',
      'owner',
      'android',
      'test-meeting-id'
    );

    assert(conn.clientType === 'android', 'Device client presence categorized correctly as "android"');
    
    const activeConns = connectionManager.getMeetingConnections('test-meeting-id');
    assert(activeConns.length === 1 && activeConns[0].connectionId === connId, 'Accurately counts active devices connected to the meeting');

    const pingSuccess = connectionManager.registerHeartbeat(connId);
    assert(pingSuccess, 'Updates heartbeat successfully');

    connectionManager.removeConnection(connId);
    assert(connectionManager.getMeetingConnections('test-meeting-id').length === 0, 'Closes/removes connection correctly');
  } catch (err: any) {
    assert(false, `Presence Tracking threw error: ${err.message}`);
  }

  console.log('=============================================================');
  console.log(`📊 TESTS COMPLETE: ${passedCount} PASSED, ${failedCount} FAILED.`);
  console.log('=============================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

export { runTests };
