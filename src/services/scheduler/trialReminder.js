// src/services/scheduler/trialReminder.js
import Registration from '../../database/models/Registration.js';
import MailService from '../email/mailService.js';
import { REMINDER_DAYS } from '../../shared/constants/appConstants.js';
import 'dotenv/config';
import schedule from 'node-schedule';

export default class TrialReminderService {
  constructor() {
    this.mailService = new MailService();
    this.trialDays = parseInt(process.env.TRIAL_DAYS || 7, 10);

    // Run once at server start
    this.runScheduler();

    // Run daily at 2 PM
    schedule.scheduleJob('0 14 * * *', () => this.runScheduler());
  }

  getReminderDate(createdAt, daysBeforeExpiry) {
    const expiryDate = new Date(createdAt);
    expiryDate.setDate(
      expiryDate.getDate() + this.trialDays - daysBeforeExpiry
    );
    expiryDate.setHours(13, 59, 0, 0);
    return expiryDate;
  }

  scheduleRemindersForRegistration(reg) {
    REMINDER_DAYS.forEach(daysLeft => {
      if ((reg.trial_email_sent_days || []).includes(daysLeft)) return;

      const reminderTime = this.getReminderDate(reg.created_at, daysLeft);

      if (reminderTime > new Date()) {
        schedule.scheduleJob(reminderTime, async () => {
          try {
            await this.mailService.sendTrialReminder(reg.email, daysLeft);

            const updatedDays = [
              ...(reg.trial_email_sent_days || []),
              daysLeft,
            ];
            await reg.update({ trial_email_sent_days: updatedDays });

            logger.info(
              '📧 Sent reminder to :email (:daysLeft days left) at :time',
              { email: reg.email, daysLeft, time: reminderTime }
            );
          } catch (err) {
            logger.error(
              'Failed to send reminder for :email (:daysLeft days left)',
              { email: reg.email, daysLeft, error: err }
            );
          }
        });

        logger.info(
          'Scheduled reminder for :email (:daysLeft days left) at :time',
          { email: reg.email, daysLeft, time: reminderTime }
        );
      }
    });
  }

  async runScheduler() {
    logger.info('Running trial reminder scheduler...');
    try {
      const registrations = await Registration.findAll({
        where: { infra_setup_done: true }, // ✅ filter only those with infra ready
      });

      registrations.forEach(reg => this.scheduleRemindersForRegistration(reg));
    } catch (err) {
      logger.error('Error in trial reminder scheduler:', { error: err });
    }
  }
}
