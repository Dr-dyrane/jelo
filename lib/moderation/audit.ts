import 'server-only';

// Next-rendered code enters through this server-only facade. The implementation
// is shared with the private command-line operator so every path writes the same
// append-only audit row.
export { recordModerationAction } from './database-transitions';
