import { DateTime } from 'luxon';
import { VenueStatusEnum } from '../dto/get-venues.dto';
import { VenueHelperService } from './venue-helper.service';

// Mock dependencies
const mockPrismaService = {
  client: {
    venue: {
      findUnique: () => Promise.resolve(currentVenueMock),
    },
  },
} as any;

const mockGoogleMapsService = {
  getTimezone: () => Promise.resolve('America/Chicago'), // Venue in Central Time
} as any;

let currentVenueMock: any = null;

async function runTests() {
  const service = new VenueHelperService(
    mockPrismaService,
    mockGoogleMapsService,
  );
  console.log('--- Starting Venue Logic Verification ---');

  const now = DateTime.now();
  console.log(`Current Time (System): ${now.toFormat('HH:mm')}`);

  // Test 1: Outside Operating Hours
  console.log('\nTest 1: Outside Operating Hours');
  // Set hours to be in the past
  const pastStart = now.minus({ hours: 4 }).toFormat('HH:mm');
  const pastEnd = now.minus({ hours: 2 }).toFormat('HH:mm');

  currentVenueMock = {
    id: 'test-venue-1',
    latitude: 41.8781,
    longitude: -87.6298, // Chicago
    closedDays: [],
    startTime: pastStart,
    endTime: pastEnd,
    votes: [], // No votes
  };

  let status = await service.getVenueStatus('test-venue-1');
  if (status === VenueStatusEnum.CLOSED) {
    console.log('✅ Passed: Status is CLOSED when outside hours.');
  } else {
    console.error(`❌ Failed: Expected CLOSED, got ${status}`);
  }

  // Test 2: Inside Operating Hours (No Votes)
  console.log('\nTest 2: Inside Operating Hours (No Votes)');
  // Set hours to surround current time relative to Chicago time
  const venueTime = now.setZone('America/Chicago');
  const start = venueTime.minus({ hours: 2 }).toFormat('HH:mm');
  const end = venueTime.plus({ hours: 2 }).toFormat('HH:mm');

  currentVenueMock = {
    id: 'test-venue-2',
    latitude: 41.8781,
    longitude: -87.6298,
    closedDays: [],
    startTime: start,
    endTime: end,
    votes: [],
  };

  status = await service.getVenueStatus('test-venue-2');
  if (status === VenueStatusEnum.OPEN) {
    console.log('✅ Passed: Status is OPEN when within hours (and no votes).');
  } else {
    console.error(`❌ Failed: Expected OPEN, got ${status}`);
  }

  // Test 3: Vote Reset Logic (ET 8 AM)
  console.log('\nTest 3: Vote Reset Logic (ET 8 AM)');
  // We need to determine the critical 8 AM ET boundary relative to NOW
  const etNow = DateTime.now().setZone('America/New_York');
  let boundary = etNow.set({ hour: 8, minute: 0, second: 0, millisecond: 0 });
  if (etNow < boundary) {
    boundary = boundary.minus({ days: 1 });
  }

  console.log(`Current ET Time: ${etNow.toString()}`);
  console.log(`Vote Boundary (8 AM ET): ${boundary.toString()}`);

  // Determine operating hours that are strictly OPEN so we can test the VOTE logic
  // (If hours were closed, votes wouldn't matter due to our new logic)
  const openStart = venueTime.minus({ hours: 5 }).toFormat('HH:mm');
  const openEnd = venueTime.plus({ hours: 5 }).toFormat('HH:mm');

  // Case A: Vote BEFORE boundary (should be ignored -> default to OPEN due to hours)
  // Wait, if ignored, it falls back to hours.
  // To verify it IS ignored, we should set votes to indicate CLOSED.
  // If the vote is counted, result is CLOSED. If ignored, default OPEN.

  const oldVoteDate = boundary.minus({ minutes: 1 }).toJSDate();

  currentVenueMock = {
    id: 'test-venue-3',
    latitude: 41.8781,
    longitude: -87.6298,
    closedDays: [],
    startTime: openStart,
    endTime: openEnd,
    votes: [
      { isOpen: false, createdAt: oldVoteDate }, // Vote says CLOSED
    ],
  };

  status = await service.getVenueStatus('test-venue-3');
  // Needs 1 vote to swing it?
  // Logic: if todayVotes > 0.
  // Here expected todayVotes = 0.
  // Fallback -> OPEN.
  if (status === VenueStatusEnum.OPEN) {
    console.log('✅ Passed: Old vote (before 8 AM ET) is ignored.');
  } else {
    console.error(
      `❌ Failed: Expected OPEN, got ${status}. Old vote was likely counted.`,
    );
  }

  // Case B: Vote AFTER boundary (should be counted)
  const newVoteDate = boundary.plus({ minutes: 1 }).toJSDate();

  currentVenueMock = {
    id: 'test-venue-4',
    latitude: 41.8781,
    longitude: -87.6298,
    closedDays: [],
    startTime: openStart,
    endTime: openEnd,
    votes: [
      { isOpen: false, createdAt: newVoteDate }, // Vote says CLOSED
    ],
  };

  status = await service.getVenueStatus('test-venue-4');
  // Expected todayVotes = 1 (CLOSED).
  // Logic: openVotes (0) >= closedVotes (1) ? OPEN : CLOSED -> CLOSED.
  if (status === VenueStatusEnum.CLOSED) {
    console.log('✅ Passed: New vote (after 8 AM ET) is counted.');
  } else {
    console.error(
      `❌ Failed: Expected CLOSED, got ${status}. New vote was likely ignored.`,
    );
  }
}

runTests().catch(console.error);
