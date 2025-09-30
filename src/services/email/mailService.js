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

  async sendInstanceReadyMail(
    to,
    dfmUrl = 'http',
    nifiUrl,
    registryUrl,
    registrationId,
    registration
  ) {
    // Path to EJS template
    const templatePath = path.join(
      __dirname,
      '../../shared/templates/email/dfmProvisioning.ejs'
    );

    const html = await ejs.renderFile(templatePath, {
      recieverName: 'John Doe',
      registrationId: 'N/A',
      dfmUrl: dfmUrl || '#',
      nifiUrl: nifiUrl || '#',
      registryUrl: registryUrl || '#',
      logo: '/icons/logo.png',
      urlIcon: '/icons/url.png',
      year: new Date().getFullYear(),
    });
    // Send email
    await this.transporter.sendMail({
      from: `"DFM Team" <${process.env.SMTP_FROM}>`,
      to,
      subject: `Your DFM instance is ready!`,
      html,
    });

    console.log(`Email sent to ${to} with registration ID ${registrationId}`);
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
      });

      // Send the email
      await this.transporter.sendMail({
        from: `"DFM Team" <${process.env.SMTP_FROM}>`,
        to: email,
        subject: `Trial Expiry Reminder`,
        html, // Use rendered HTML instead of plain text
      });

      console.log(`Trial reminder sent to ${email}`);
    } catch (err) {
      console.error('Failed to send trial reminder:', err);
      throw err;
    }
  }
}
