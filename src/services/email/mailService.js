import nodemailer from 'nodemailer';
import 'dotenv/config';
import ejs from 'ejs';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default class MailService {
  constructor() {
    // Create the transporter once
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendInstanceReadyMail({
    to,
    dfmUrl = 'http',
    nifiUrl1,
    nifiUrl2,
    registryUrl,
    registrationId,
    registration,
    username,
  }) {
    // Path to EJS template
    const templatePath = path.join(
      __dirname,
      '../../shared/templates/email/dfmProvisioning.ejs'
    );

    const html = await ejs.renderFile(templatePath, {
      userName: username,
      dfmUrl: dfmUrl,
      username: 'system.administrator@dfm.com',
      password: 'systemadmin@dfm',
      nifi1Url: nifiUrl1,
      nifi2Url: nifiUrl2,
      registryUrl: registryUrl,
    });

    // Send email
    await this.transporter.sendMail({
      from: `"DFM Team" <${process.env.SMTP_FROM}>`,
      to,
      subject: `Your DFM instance is ready!`,
      html,
    });

    logger.info('Email sent to :to with registration ID :registrationId', {
      to,
      registrationId,
    });
  }

  async sendTrialReminder(email, daysLeft) {
    try {
      // Path to EJS template for trial reminder
      const templatePath = path.join(
        __dirname,
        '../../shared/templates/email/trialReminder.ejs'
      );

      // Render the template
      const html = await ejs.renderFile(templatePath, {
        daysLeft,
        year: new Date().getFullYear(),
        logoUrl: '/icons/logo.png',
      });

      // Send the email
      await this.transporter.sendMail({
        from: `"DFM Team" <${process.env.SMTP_FROM}>`,
        to: email,
        subject: `Trial Expiry Reminder`,
        html,
      });

      logger.info('Trial reminder sent to :email', { email });
    } catch (err) {
      logger.error('Failed to send trial reminder', { email, error: err });
      throw err;
    }
  }
}
