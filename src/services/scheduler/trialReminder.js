import Registration from '../../database/models/Registration.js';
import MailService from '../email/mailService.js';
import { REMINDER_DAYS } from '../../shared/constants/appConstants.js';
import 'dotenv/config';
import schedule from 'node-schedule';

const mailService = new MailService();

const daysUntilExpiry = (createdAt) => {
  const expiryDate = new Date(createdAt);
  expiryDate.setDate(
    expiryDate.getDate() + parseInt(process.env.TRIAL_DAYS || 7, 10)
  );
  const today = new Date();
  return Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
};

export const processTrialReminders = async () => {
  console.log('🕒 Running trial reminder check...');
  try {
    const registrations = await Registration.findAll();

    for (const reg of registrations) {
      const remainingDays = daysUntilExpiry(reg.created_at);

      if (
        REMINDER_DAYS.includes(remainingDays) &&
        !(reg.trial_email_sent_days || []).includes(remainingDays)
      ) {
        await mailService.sendTrialReminder(reg.email, remainingDays);
        await reg.update({
          trial_email_sent_days: [...(reg.trial_email_sent_days || []), remainingDays],
        });
        console.log(`📧 Sent reminder to ${reg.email} (${remainingDays} days left)`);
      }
    }
  } catch (err) {
    console.error('❌ Error processing trial reminders:', err);
  }
};

// Run immediately on server start
processTrialReminders();

// Schedule daily at 8 AM
schedule.scheduleJob('0 8 * * *', processTrialReminders);
