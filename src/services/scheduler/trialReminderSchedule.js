import { Op } from 'sequelize';

import Registration from '../../database/models/Registration.js';
import MailService from '../email/mailService.js';
import { REMINDER_DAYS } from '../../shared/constants/appConstants.js';
import 'dotenv/config';
import schedule from 'node-schedule';
import { logger } from '../../shared/index.js';

export default class TrialReminderService {
  constructor() {
    this.mailService = new MailService();
    this.trialDays = parseInt(process.env.TRIAL_DAYS || 15, 10);
    this.scheduledReminders = new Map(); //

    // Run once at server start
    this.runScheduler();

    // Run daily at 2 PM
    schedule.scheduleJob('0 8 * * *', () => this.runScheduler());
  }

  getReminderDate(createdAt, daysBeforeExpiry) {
    const expiryDate = new Date(createdAt);
    expiryDate.setDate(
      expiryDate.getDate() + this.trialDays - daysBeforeExpiry
    );
    expiryDate.setHours(13, 51, 0, 0);
    return expiryDate;
  }

  scheduleRemindersForRegistration(reg) {
    REMINDER_DAYS.forEach(daysLeft => {
      if ((reg.trial_email_sent_days || []).includes(daysLeft)) return;

      const reminderTime = this.getReminderDate(reg.created_at, daysLeft);

      // Store in schedule map for listing later
      if (!this.scheduledReminders.has(reg.id)) {
        this.scheduledReminders.set(reg.id, []);
      }
      this.scheduledReminders
        .get(reg.id)
        .push({ email: reg.email, date: reminderTime });

      const sendReminder = async () => {
        try {
          await this.mailService.sendTrialReminder({
            userName: reg?.name,
            email: reg.email,
            daysLeft,
          });
          const updatedDays = [...(reg.trial_email_sent_days || []), daysLeft];
          await reg.update({ trial_email_sent_days: updatedDays }); 
          logger.info(
            `Sent reminder to ${reg.email} (${daysLeft} days left)`
          );
        } catch (err) {
          logger.error(`Failed to send reminder for ${reg.email}`, {
            error: err,
          });
        }
      };

      if (reminderTime <= new Date()) {
        // Send immediately if the scheduled time already passed
        logger.info(
          `Reminder time passed, sending immediately for ${reg.email} (${daysLeft} days left)`
        );
        sendReminder();
      } else {
        // Schedule for future
        schedule.scheduleJob(reminderTime, sendReminder);
        logger.info(
          `Scheduled reminder for ${reg.email} (${daysLeft} days left) at ${reminderTime}`
        );
      }
    });
  }

  async runScheduler() {
    logger.info('Running trial reminder scheduler...');
    try {
      const FIFTEEN_MINUTES = 15 * 60 * 1000; // 15 minutes in milliseconds
      const cutoffTime = new Date(Date.now() - FIFTEEN_MINUTES);

      const registrations = await Registration.findAll({
        where: {
          infra_setup_done: true,
          created_at: {
            [Op.lt]: cutoffTime,
          },
        },
      });

      registrations.forEach(reg => this.scheduleRemindersForRegistration(reg));
    } catch (err) {
      logger.error('Error in trial reminder scheduler:', { error: err });
    }
  }
}
