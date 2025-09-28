import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import { fileURLToPath } from 'url';
import 'dotenv/config';

import MailService from '../email/mailService.js';
const mailService = new MailService();

const execAsync = util.promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default class TerraformService {
  constructor() {
    this.baseDir = path.join(__dirname, 'base'); // shared Terraform module
    this.infraDir = path.join(__dirname, '../../infraRegistrations'); // per-registration dirs
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

      // Copy all base files to registration folder
      for (const file of fs.readdirSync(this.baseDir)) {
        const src = path.join(this.baseDir, file);
        const dest = path.join(registrationDir, file);
        fs.copyFileSync(src, dest);
      }

      // Generate dynamic main.tf per registration
      const mainTf = `
  module "registration_infra" {
  source          = "${this.baseDir.replace(/\\/g, '/')}"
  registration_id = "${registrationId}"
}
`;
      fs.writeFileSync(path.join(registrationDir, 'main.tf'), mainTf);

      // Run Terraform commands
      const runTerraform = async cmd => {
        console.log(`🔧 Running terraform ${cmd}...`);
        const { stdout, stderr } = await execAsync(`terraform ${cmd}`, {
          cwd: registrationDir,
          env: { ...process.env }, // picks up AWS creds & TF_VAR_* automatically
        });
        if (stderr) console.error(stderr);
        return stdout;
      };

      const initOut = await runTerraform('init -input=false');
      console.log(`✅ Terraform init:\n${initOut}`);

      const planOut = await runTerraform('plan -input=false');
      console.log(`📋 Terraform plan:\n${planOut}`);

      const applyOut = await runTerraform('apply -input=false -auto-approve');
      console.log(`⚡ Terraform apply:\n${applyOut}`);

      // Extract dfm_url output
      const urlMatch = applyOut.match(/dfm_url\s*=\s*"(.+?)"/);
      const instanceUrl = urlMatch
        ? urlMatch[1]
        : `http://ec2-instance-${registrationId}.amazonaws.com`;

      // send notification email
      await mailService.sendInstanceReadyMail(
        'user@example.com',
        instanceUrl,
        registrationId
      );

      return instanceUrl;
    } catch (err) {
      console.error(
        `❌ Terraform failed for registration ${registrationId}:`,
        err.stderr || err
      );
      throw err;
    }
  }
}
