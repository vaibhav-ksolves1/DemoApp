import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import { fileURLToPath } from 'url';

const execAsync = util.promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default class TerraformService {
  constructor() {
    this.baseDir = path.join(__dirname, 'base'); // all Terraform files live here
    this.infraDir = path.join(__dirname, '../../infraRegistrations'); // per-registration working dirs
  }

  async provisionInfrastructure(registrationId) {
    const registrationDir = path.join(this.infraDir, String(registrationId));

    try {
      console.log(
        `🚀 Start provisioning infra for registration ${registrationId}`
      );

      // Ensure registration dir exists
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

      // const stateFile = path.join(registrationDir, 'terraform.tfstate');

      const runTerraform = async cmd => {
        console.log(`🔧 Running terraform ${cmd}...`);
        const { stdout, stderr } = await execAsync(
          `terraform ${cmd} -var-file="aws_creds.tfvars"`,
          { cwd: registrationDir, env: { ...process.env } }
        );
        if (stderr) console.error(stderr);
        return stdout;
      };

      // Terraform init
      const initOut = await runTerraform('init -input=false');
      console.log(`✅ Terraform init:\n${initOut}`);

      // Terraform plan
      const planOut = await runTerraform('plan -input=false');
      console.log(`📋 Terraform plan:\n${planOut}`);

      // Terraform apply
      const applyOut = await runTerraform('apply -input=false -auto-approve');
      console.log(`⚡ Terraform apply:\n${applyOut}`);

      // Extract URL (from outputs)
      const urlMatch = applyOut.match(/dfm_url\s*=\s*"(.+?)"/);
      const instanceUrl = urlMatch
        ? urlMatch[1]
        : `http://ec2-instance-${registrationId}.amazonaws.com`;

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
