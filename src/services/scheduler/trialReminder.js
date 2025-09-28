import Registration from '../../database/models/Registration.js';
import MailService from '../email/mailService.js';
import { REMINDER_DAYS } from '../../shared/constants/appConstants.js';
import 'dotenv/config';
import schedule from 'node-schedule';

export default class TrialReminderService {
  constructor() {
    this.mailService = new MailService();
    this.trialDays = parseInt(process.env.TRIAL_DAYS || 7, 10);

    // Immediately schedule reminders on server start
    this.runScheduler();

    // Schedule cron daily at 2 PM
    schedule.scheduleJob('0 14 * * *', () => this.runScheduler());
  }

  // Returns the exact date when a reminder should be sent
  getReminderDate(createdAt, daysBeforeExpiry) {
    const expiryDate = new Date(createdAt);
    expiryDate.setDate(expiryDate.getDate() + this.trialDays - daysBeforeExpiry);
    expiryDate.setHours(13, 59, 0, 0); // Set reminder time to 1:59 PM
    return expiryDate;
  }

  // Schedule reminders for a single registration
  scheduleRemindersForRegistration(reg) {
    REMINDER_DAYS.forEach((daysLeft) => {
      if ((reg.trial_email_sent_days || []).includes(daysLeft)) return;

      const reminderTime = this.getReminderDate(reg.created_at, daysLeft);

      if (reminderTime > new Date()) {
        schedule.scheduleJob(reminderTime, async () => {
          try {
            await this.mailService.sendTrialReminder(reg.email, daysLeft);
            const updatedDays = [...(reg.trial_email_sent_days || []), daysLeft];
            await reg.update({ trial_email_sent_days: updatedDays });
            console.log(
              `📧 Sent reminder to ${reg.email} (${daysLeft} days left) at ${reminderTime}`
            );
          } catch (err) {
            console.error(
              `❌ Failed to send reminder for ${reg.email} (${daysLeft} days left):`,
              err
            );
          }
        });

        console.log(
          `⏱ Scheduled reminder for ${reg.email} (${daysLeft} days left) at ${reminderTime}`
        );
      }
    });
  }

  // Scheduler to run daily and queue reminders
  async runScheduler() {
    console.log('🕒 Running trial reminder scheduler...');
    try {
      const registrations = await Registration.findAll();
      registrations.forEach((reg) => this.scheduleRemindersForRegistration(reg));
    } catch (err) {
      console.error('❌ Error in trial reminder scheduler:', err);
    }
  }
}
