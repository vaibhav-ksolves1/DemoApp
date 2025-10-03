import fs from 'fs';
import path from 'path';
import 'dotenv/config';
import { exec } from 'child_process';
import util from 'util';
import { fileURLToPath } from 'url';

import MailService from '../email/mailService.js';
import Registration from '../../database/models/Registration.js';
import { bootstrap } from '../bootstrap/index.js';

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
        logger.debug('Created infra folder for registration :registrationId', {
          registrationId,
        });
      }

      // Copy all base module files
      for (const file of fs.readdirSync(this.baseDir)) {
        const src = path.join(this.baseDir, file);
        const dest = path.join(registrationDir, file);
        fs.copyFileSync(src, dest);
      }

      // Generate dynamic root main.tf
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
  
  `;
      fs.writeFileSync(path.join(registrationDir, 'main.tf'), mainTf);

      const registration = await Registration.findByPk(registrationId);
      logger.debug('Fetched registration data', { registration });

      // Helper to run Terraform commands
      const runTerraform = async cmd => {
        logger.debug('Running terraform :cmd...', { cmd });
        try {
          const { stdout, stderr } = await execAsync(`terraform ${cmd}`, {
            cwd: registrationDir,
            env: {
              ...process.env,
              AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
              AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
              AWS_SESSION_TOKEN: process.env.AWS_SESSION_TOKEN,
              AWS_REGION: process.env.AWS_REGION || 'ap-south-1',
            },
            maxBuffer: 1024 * 1024, // 1MB buffer
          });
          if (stderr)
            logger.warn('Terraform warning for :cmd', { cmd, stderr });
          return stdout;
        } catch (err) {
          logger.error('Terraform command failed for :cmd', {
            cmd,
            error: err,
          });
          throw err;
        }
      };

      const username =
        registration?.dataValues?.name.toLowerCase().trim()?.replace(' ', '') ||
        `demo${registrationId}`;

      // Run Terraform workflow
      await runTerraform('init -input=false');
      await runTerraform(`plan -input=false  -var="user_domain=${username}"`);
      await runTerraform(
        `apply -input=false -auto-approve  -var="user_domain=${username}"`
      );

      // Get outputs as JSON
      const outputJson = await runTerraform('output -json');
      let dfmUrl = '';
      let nifiUrl1 = '';
      let nifiUrl2 = '';
      let registryUrl = '';

      try {
        const outputs = JSON.parse(outputJson);

        dfmUrl = outputs.dfm_url?.value;
        nifiUrl1 = outputs.nifi_0_url?.value + '/nifi';
        nifiUrl2 = outputs.nifi_1_url?.value + '/nifi';
        registryUrl = outputs.nifi_registry_url?.value + '/nifi-registry';

        logger.debug('Terraform outputs parsed', {
          dfmUrl,
          nifiUrl1,
          nifiUrl2,
          registryUrl,
        });
      } catch (err) {
        logger.warn('Failed to parse terraform outputs JSON, using fallback', {
          error: err,
        });
        dfmUrl = `http://ec2-instance-${registrationId}.amazonaws.com:8443`;
      }

      await bootstrap({ nifiUrl1, nifiUrl2, dfmUrl, registryUrl });
      // Update registration and send email
      if (registration) {
        await registration.update({ infra_setup_done: true });

        await this.mailService.sendInstanceReadyMail({
          to: registration.email,
          username: registration?.dataValues?.name,
          // dfmUrl: 'www.avc',
          dfmUrl,
          // nifi1Url: 'nifiUrl1',
          nifiUrl1: nifiUrl1,
          // nifi2Url: 'nifiUrl2',
          nifiUrl2: nifiUrl2,
          registryUrl,
          // registryUrl: 'registryUrl',
          registrationId,
          registration,
        });

        logger.info('Email sent to :email with DFM URL :dfmUrl', {
          email: registration.email,
          dfmUrl,
        });
      } else {
        logger.warn('Registration with ID :registrationId not found', {
          registrationId,
        });
      }

      return dfmUrl;
      // return;
    } catch (err) {
      logger.error(
        'Terraform provisioning failed for registration :registrationId',
        {
          registrationId,
          error: err.stderr || err,
        }
      );
      throw err;
    }
  }
}
