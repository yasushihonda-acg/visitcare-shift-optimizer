import { clearCollection } from './utils/firestore-client.js';

clearCollection('orders').then(n => {
  console.log(`Deleted ${n} orders`);
  process.exit(0);
}).catch(console.error);
