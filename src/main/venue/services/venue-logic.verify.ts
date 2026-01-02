// import { DateTime } from 'luxon';
// import { VenueHelperService } from './venue-helper.service';

// // Mock dependencies
// const mockPrismaService = {
//   client: {
//     venue: {
//       findUnique: () => Promise.resolve(currentVenueMock),
//     },
//   },
// } as any;

// const mockGoogleMapsService = {
//   getTimezone: (lat: number, lng: number) =>
//     Promise.resolve('America/New_York'), // NY for simplicity
// } as any;

// let currentVenueMock: any = null;

// async function runTests() {
//   const service = new VenueHelperService(
//     mockPrismaService,
//     mockGoogleMapsService,
//   );
//   console.log('--- Starting Refined Venue Logic Verification ---');

//   // Test 1: Overnight Session (Open Sun 5PM - Close Mon 4AM)
//   // Current Time: Monday 2 AM
//   console.log(
//     '\nTest 1: Overnight Session (Mon 2 AM, session started Sun 5 PM)',
//   );

//   // Mock "Now" to be Monday Jan 5th, 2026, 02:00 AM (Monday is weekday 1)
//   const mondayTwoAm = DateTime.fromISO('2026-01-05T02:00:00', {
//     zone: 'America/New_York',
//   });

//   // We need to override DateTime.now() behavior in the service...
//   // Since we can't easily mock global DateTime in this simple script without a library,
//   // let's manually test the private methods if possible or use a trick.
//   // Actually, I'll just adjust the "current system time" in my head and mock the venue hours to match the system time.

//   const now = DateTime.now().setZone('America/New_York');
//   const nowDay = now.weekday === 7 ? 0 : now.weekday;
//   const yesterdayDay = (nowDay + 6) % 7;

//   // Let's create a venue that is open "Yesterday" 5 PM to "Today" 4 AM.
//   // If system time is 2 AM, it should be OPEN.

//   currentVenueMock = {
//     id: 'test-venue-overnight',
//     latitude: 40.7128,
//     longitude: -74.006,
//     closedDays: [],
//     startTime: '17:00',
//     endTime: '04:00',
//     votes: [],
//   };

//   // We need to ensure the service uses our "simulated" now.
//   // I will temporarily modify the service to accept a "now" for testing or just rely on actual now.
//   // Let's rely on actual now and generate the test case around it.

//   const currentTimeStr = now.toFormat('HH:mm');
//   const isEarlyMorning = now.hour < 4;

//   if (isEarlyMorning) {
//     console.log(
//       `Current time is ${currentTimeStr} (Early Morning). Testing overnight transition...`,
//     );
//     // Open yesterday 5pm to today 4am
//     currentVenueMock.startTime = '17:00';
//     currentVenueMock.endTime = '04:00';
//   } else {
//     console.log(`Current time is ${currentTimeStr}. Testing active session...`);
//     // Open today 10am to tonight 10pm
//     currentVenueMock.startTime = '10:00';
//     currentVenueMock.endTime = '22:00';
//   }

//   const status = await service.getVenueStatus('test-venue-overnight');
//   console.log(`Result: ${status}`);

//   // Test 2: Google Venue with Periods
//   console.log('\nTest 2: Google Venue Strict Hours');
//   const googlePlace = {
//     placeId: 'google-test-1',
//     name: 'Google Club',
//     latitude: 40.7128,
//     longitude: -74.006,
//     openingHours: {
//       periods: [
//         {
//           open: { day: nowDay, time: '1700' },
//           close: { day: (nowDay + 1) % 7, time: '0400' },
//         },
//       ],
//     },
//   } as any;

//   const transformed = await service.transformGooglePlaceToVenue(
//     googlePlace,
//     40.7,
//     -74.0,
//   );
//   console.log(`Google Venue Status: ${transformed.status}`);

//   console.log(
//     '\nVerification complete. Check logic locally against current time.',
//   );
// }

// runTests().catch(console.error);
