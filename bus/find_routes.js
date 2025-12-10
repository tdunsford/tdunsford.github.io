const fs = require('fs');
const path = require('path');

// Read the JSON file
const filePath = path.join(__dirname, 'sample.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// Extract routes with BLUE or F8 keys
const targetRoutes = data['stop-schedule']['route-schedules'].filter(
  rs => rs.route.key === 'BLUE' || rs.route.key === 'F8'
);

// Collect all scheduled stops and sort by estimated departure time
const allStops = [];

targetRoutes.forEach(routeSchedule => {
  const routeKey = routeSchedule.route.key;
  const routeName = routeSchedule.route.name;
  
  routeSchedule['scheduled-stops'].forEach(stop => {
    allStops.push({
      routeKey,
      routeName,
      stopKey: stop.key,
      tripKey: stop['trip-key'],
      cancelled: stop.cancelled,
      variant: stop.variant.name,
      estimatedDeparture: stop.times.departure.estimated,
      scheduledDeparture: stop.times.departure.scheduled,
      busKey: stop.bus.key
    });
  });
});

// Sort by estimated departure time
allStops.sort((a, b) => {
  return new Date(a.estimatedDeparture) - new Date(b.estimatedDeparture);
});

// Get the next 8 stops
const nextEight = allStops.slice(0, 8);

// Display results
console.log('Next 8 Scheduled Stops (sorted by estimated departure time):\n');
console.log('═'.repeat(100));

nextEight.forEach((stop, index) => {
  console.log(`\n${index + 1}. Route: ${stop.routeKey} - ${stop.routeName}`);
  console.log(`   Variant: ${stop.variant}`);
  console.log(`   Stop Key: ${stop.stopKey}`);
  console.log(`   Estimated Departure: ${new Date(stop.estimatedDeparture).toLocaleString()}`);
  console.log(`   Scheduled Departure: ${new Date(stop.scheduledDeparture).toLocaleString()}`);
  console.log(`   Bus: ${stop.busKey}`);
  console.log(`   Cancelled: ${stop.cancelled}`);
});

console.log('\n' + '═'.repeat(100));

// Also export as JSON for further processing if needed
console.log('\n\nJSON Output:');
console.log(JSON.stringify(nextEight, null, 2));
