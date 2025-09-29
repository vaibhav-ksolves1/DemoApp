import nodemailer from 'nodemailer';
import 'dotenv/config';

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

  /**
   * Send email notifying the instance is ready
   * @param {string} recipientEmail - email of the recipient
   * @param {string} instanceUrl - URL of the EC2 instance
   * @param {string} registrationId - optional registration ID for context
   */
  async sendInstanceReadyMail(
    recipientEmail,
    instanceUrl,
    registrationId = ''
  ) {
    try {
      const mailOptions = {
        from: `"DFM Infra" <no-reply@example.com>`,
        to: recipientEmail,
        subject: `Your EC2 Instance ${registrationId} is Ready 🚀`,
        html: `
          <p>Hello,</p>
          <p>Your EC2 instance ${
            registrationId ? `for registration ${registrationId} ` : ''
          }is now ready!</p>
          <p>Access it here: <a href="${instanceUrl}" target="_blank">${instanceUrl}</a></p>
          <p>Thanks,<br>Infra Team</p>
        `,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Mail sent:', info.messageId, recipientEmail);
    } catch (err) {
      console.error('❌ Failed to send mail:', err);
    }
  }

  async sendTrialReminder(email, daysLeft) {
    const mailOptions = {
      from: process.env.SMTP_USER,
      to: email,
      subject: `Trial Expiry Reminder`,
      text: `Hi, your trial will expire in ${daysLeft} day(s). Please take necessary action.`,
    };

    await this.transporter.sendMail(mailOptions);
  }
}
