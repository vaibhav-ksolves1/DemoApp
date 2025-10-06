const TRIAL_DAYS = parseInt(process.env.APP_TRIAL_DAYS, 10) || 15;
const REMINDER_DAYS = process.env.APP_REMINDER_DAYS
  ? process.env.APP_REMINDER_DAYS.split(',').map(Number)
  : [5, 3, 1];

export { TRIAL_DAYS, REMINDER_DAYS };
