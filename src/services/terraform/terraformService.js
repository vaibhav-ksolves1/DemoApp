/* The TerraformService class is responsible for provisioning infrastructure for registrations,
utilizing Terraform commands and sending emails upon successful setup. */
import fs from 'fs';
import path from 'path';
import 'dotenv/config';
import { exec } from 'child_process';
import util from 'util';
import { fileURLToPath } from 'url';

import MailService from '../email/mailService.js';
import Registration from '../../database/models/Registration.js';
import { bootstrap } from '../bootstrap/index.js';
import { logger } from '../../shared/index.js';
import TrialReminderService from '../scheduler/trialReminder.js';

const execAsync = util.promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default class TerraformService {
  constructor() {
    this.baseDir = path.join(__dirname, 'base'); // shared Terraform module
    this.infraDir = path.join(__dirname, '../../infraRegistrations'); // per-registration dirs
    this.mailService = new MailService();
  }

  async provisionInfrastructure(registrationId) {
    const registrationDir = path.join(this.infraDir, String(registrationId));

    try {
      logger.info(`Provisioning infra for registration ${registrationId}`);

      // Ensure folder exists
      if (!fs.existsSync(registrationDir)) {
        fs.mkdirSync(registrationDir, { recursive: true });
        logger.debug('Created infra folder for registration', {
          registrationId,
        });
      }

      // Copy base module files
      for (const file of fs.readdirSync(this.baseDir)) {
        fs.copyFileSync(
          path.join(this.baseDir, file),
          path.join(registrationDir, file)
        );
      }

      // Write main.tf
      const mainTf = `
  module "registration_infra" {
    source          = "${this.baseDir.replace(/\\/g, '/')}"
    registration_id = "${registrationId}"
    user_domain     = var.user_domain      
    // aws_access_key  = var.aws_access_key
    // aws_secret_key  = var.aws_secret_key
    // aws_session_token = var.aws_session_token
  }

  # Re-export module outputs so terraform output -json works
 output "dfm_url" {
  value = module.registration_infra.dfm_url
}

output "nifi_0_url" {
  value = module.registration_infra.nifi_0_url
}

output "nifi_1_url" {
  value = module.registration_infra.nifi_1_url
}
output "nifi_registry_url" {
  value = module.registration_infra.nifi_registry_url
}
  output "server_public_ip" {
  value = module.registration_infra.server_public_ip
  description = "Public IP of the server"
}
  
  `; // your existing mainTf content
      fs.writeFileSync(path.join(registrationDir, 'main.tf'), mainTf);

      const registration = await Registration.findByPk(registrationId);
      if (!registration)
        throw new Error(`Registration not found for ID ${registrationId}`);

      const runTerraform = async cmd => {
        const { stdout, stderr } = await execAsync(`terraform ${cmd}`, {
          cwd: registrationDir,
          env: { ...process.env },
          maxBuffer: 1024 * 1024,
        });
        if (stderr) logger.warn('Terraform warning', { cmd, stderr });
        return stdout;
      };

      const username = registration.dataValues.name
        ? registration.dataValues.name.toLowerCase().trim().replace(' ', '')
        : `demo${registrationId}`;

      // Terraform workflow
      await runTerraform('init -input=false');
      await runTerraform(`plan -input=false -var="user_domain=${username}"`);
      await runTerraform(
        `apply -input=false -auto-approve -var="user_domain=${username}"`
      );

      const outputJson = await runTerraform('output -json');
      const outputs = JSON.parse(outputJson);

      const dfmUrl =
        outputs.dfm_url?.value ||
        `http://ec2-instance-${registrationId}.amazonaws.com:8443`;
      const nifiUrl1 = outputs.nifi_0_url?.value
        ? outputs.nifi_0_url.value + '/nifi'
        : '';
      const nifiUrl2 = outputs.nifi_1_url?.value
        ? outputs.nifi_1_url.value + '/nifi'
        : '';
      const registryUrl = outputs.nifi_registry_url?.value
        ? outputs.nifi_registry_url.value + '/nifi-registry'
        : '';

      logger.debug('Outputs:', outputs);
      await bootstrap({ nifiUrl1, nifiUrl2, dfmUrl, registryUrl });

      // ✅ Only update DB and send email if everything above succeeds
      await registration.update({ infra_setup_done: true });

      await this.mailService.sendInstanceReadyMail({
        to: registration.email,
        username: registration.dataValues.name,
        dfmUrl,
        nifiUrl1,
        nifiUrl2,
        registryUrl,
        registrationId,
        registration,
      });

      logger.info('Email sent to :email with DFM URL :dfmUrl', {
        email: registration.email,
        dfmUrl,
      });

      // Schedule trial reminders for new registrations
      new TrialReminderService();

      return dfmUrl;
    } catch (err) {
      logger.error(
        'Terraform provisioning failed for registration :registrationId',
        {
          registrationId,
          error: err.stderr || err,
        }
      );
      // ✅ Do NOT send any email if error occurs
      throw err;
    }
  }
}
