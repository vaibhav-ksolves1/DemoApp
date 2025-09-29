import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import { fileURLToPath } from 'url';
import 'dotenv/config';

import MailService from '../email/mailService.js';
import Registration from '../../database/models/Registration.js';

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
      console.log(`🚀 Provisioning infra for registration ${registrationId}`);

      // Ensure folder exists
      if (!fs.existsSync(registrationDir)) {
        fs.mkdirSync(registrationDir, { recursive: true });
        console.log(
          `📂 Created infra folder for registration ${registrationId}`
        );
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
}

# Re-export module outputs so terraform output -json works
output "dfm_public_ip" {
  value = module.registration_infra.dfm_public_ip
}

output "dfm_url" {
  value = module.registration_infra.dfm_url
}
`;
      fs.writeFileSync(path.join(registrationDir, 'main.tf'), mainTf);

      // Helper to run Terraform commands
      const runTerraform = async cmd => {
        console.log(`🔧 Running terraform ${cmd}...`);
        try {
          const { stdout, stderr } = await execAsync(`terraform ${cmd}`, {
            cwd: registrationDir,
            env: { ...process.env },
            maxBuffer: 1024 * 1024, // 1 MB
          });
          if (stderr) console.log('ℹ️ Terraform info:', stderr);
          return stdout;
        } catch (err) {
          console.error('❌ Terraform command failed:', err);
          throw err;
        }
      };

      // Run Terraform workflow
      await runTerraform('init -input=false');
      await runTerraform('plan -input=false');
      await runTerraform('apply -input=false -auto-approve');

      // Get outputs as JSON
      // Get outputs as JSON
      const outputJson = await runTerraform('output -json');
      let dfmUrl = '';
      try {
        const outputs = JSON.parse(outputJson);
        if (outputs.dfm_url?.value) {
          dfmUrl = outputs.dfm_url.value;
        } else {
          console.warn(
            '⚠️ dfm_url not found in Terraform outputs, using fallback'
          );
          dfmUrl = `http://ec2-instance-${registrationId}.amazonaws.com:8443`;
        }
        console.log('🌐 DFM URL:', dfmUrl);
      } catch (err) {
        console.warn('⚠️ Could not parse terraform outputs JSON:', err);
        dfmUrl = `http://ec2-instance-${registrationId}.amazonaws.com:8443`;
      }

      // Update registration and send email
      const registration = await Registration.findByPk(registrationId);
      if (registration) {
        await registration.update({ infra_setup_done: true });

        await this.mailService.sendInstanceReadyMail(
          registration.email,
          dfmUrl, // only send dfm_url
          registrationId
        );

        console.log(
          `📧 Email sent to ${registration.email} with DFM URL: ${dfmUrl}`
        );
      } else {
        console.warn(`⚠️ Registration with ID ${registrationId} not found`);
      }

      return dfmUrl;
    } catch (err) {
      console.error(
        `❌ Terraform failed for registration ${registrationId}:`,
        err.stderr || err
      );
      throw err;
    }
  }
}
