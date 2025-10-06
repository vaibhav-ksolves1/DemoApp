/* The TerraformService class is responsible for provisioning infrastructure for registrations,
utilizing Terraform commands and sending emails upon successful setup. */
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

import { fileURLToPath } from 'url';

import MailService from '../email/mailService.js';
import Registration from '../../database/models/Registration.js';
import { bootstrap } from '../bootstrap/index.js';
import { logger, runTerraform } from '../../shared/index.js';
import TrialReminderService from '../scheduler/trialReminderSchedule.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default class TerraformService {
  constructor() {
    this.baseDir = path.join(__dirname, 'base'); // shared Terraform module
    this.infraDir = path.join(__dirname, '../../infraRegistrations'); // per-registration dirs
    this.mailService = new MailService();
  }

  async provisionInfrastructure(registrationId) {
    try {
      logger.info(`Provisioning infra for registration ${registrationId}`);

      const registrationDir = await this._prepareRegistrationFolder(
        registrationId
      );
      const registration = await this._getRegistration(registrationId);
      const username = this._generateUsername(registration, registrationId);

      await this._generateMainTf(registrationDir, registrationId);

      await this._runTerraformWorkflow(registrationDir, username);

      const { dfmUrl, nifi1Url, nifi2Url, registryUrl } =
        await this._getTerraformOutputs(registrationDir, registrationId);

      await bootstrap({ nifi1Url, nifi2Url, dfmUrl, registryUrl });

      await this._finalizeSetup({
        registration,
        to: registration.email,
        username: registration.dataValues.name,

        // Dummy/local URLs for testing
        dfmUrl: 'http://localhost:8080/dfm',
        dfmUsername: process.env.DFM_DEFAULT_ADMIN_USER || 'admin',
        dfmPassword: process.env.DFM_DEFAULT_ADMIN_PASS || 'admin@123',

        nifi1Url: 'http://localhost:8081/nifi',
        nifi1Username: process.env.NIFI_DEFAULT_ADMIN_USER || 'admin',
        nifi1Password: process.env.NIFI_DEFAULT_ADMIN_PASS || 'adminpass1234',

        nifi2Url: 'http://localhost:8082/nifi',
        nifi2Username: process.env.NIFI_DEFAULT_ADMIN_USER || 'admin',
        nifi2Password: process.env.NIFI_DEFAULT_ADMIN_PASS || 'adminpass1234',

        registryUrl: 'http://localhost:18080/nifi-registry',
        registrationId,
      });

      return dfmUrl;
    } catch (err) {
      console.log('y', err);
      logger.error('Terraform provisioning failed', {
        registrationId,
        error: err.stderr || err,
      });
      throw err;
    }
  }

  async _prepareRegistrationFolder(registrationId) {
    const registrationDir = path.join(this.infraDir, String(registrationId));

    if (!fs.existsSync(registrationDir)) {
      fs.mkdirSync(registrationDir, { recursive: true });
      logger.debug('Created infra folder for registration', { registrationId });
    }

    for (const file of fs.readdirSync(this.baseDir)) {
      fs.copyFileSync(
        path.join(this.baseDir, file),
        path.join(registrationDir, file)
      );
    }

    return registrationDir;
  }

  async _generateMainTf(registrationDir, registrationId) {
    const mainTf = `
module "registration_infra" {
  source          = "${this.baseDir.replace(/\\/g, '/')}"
  registration_id = "${registrationId}"
  user_domain     = var.user_domain
}

output "dfm_url" { value = module.registration_infra.dfm_url }
output "nifi_0_url" { value = module.registration_infra.nifi_0_url }
output "nifi_1_url" { value = module.registration_infra.nifi_1_url }
output "nifi_registry_url" { value = module.registration_infra.nifi_registry_url }
output "server_public_ip" { value = module.registration_infra.server_public_ip }
`;
    fs.writeFileSync(path.join(registrationDir, 'main.tf'), mainTf);
  }

  _generateUsername(registration, registrationId) {
    const name = registration?.dataValues?.name || '';
    return name
      ? name.toLowerCase().trim().replace(' ', '')
      : `demo${registrationId}`;
  }

  async _getRegistration(registrationId) {
    const registration = await Registration.findByPk(registrationId);
    if (!registration)
      throw new Error(`Registration not found for ID ${registrationId}`);
    return registration;
  }

  async _runTerraformWorkflow(registrationDir, username) {
    await runTerraform('init -input=false', registrationDir);
    await runTerraform(
      `plan -input=false -var="user_domain=${username}"`,
      registrationDir
    );
    await runTerraform(
      `apply -input=false -auto-approve -var="user_domain=${username}"`,
      registrationDir
    );
  }

  async _getTerraformOutputs(registrationDir, registrationId) {
    const outputJson = await this._runTerraform(
      'output -json',
      registrationDir
    );

    try {
      const outputs = JSON.parse(outputJson);
      return {
        dfmUrl:
          outputs.dfm_url?.value ||
          `http://ec2-instance-${registrationId}.amazonaws.com:8443`,
        nifi1Url: outputs.nifi_0_url?.value
          ? outputs.nifi_0_url.value + '/nifi'
          : '',
        nifi2Url: outputs.nifi_1_url?.value
          ? outputs.nifi_1_url.value + '/nifi'
          : '',
        registryUrl: outputs.nifi_registry_url?.value
          ? outputs.nifi_registry_url.value + '/nifi-registry'
          : '',
      };
    } catch (err) {
      logger.warn('Failed to parse Terraform outputs JSON', { error: err });
      return {
        dfmUrl: `http://ec2-instance-${registrationId}.amazonaws.com:8443`,
        nifi1Url: '',
        nifi2Url: '',
        registryUrl: '',
      };
    }
  }

  async _finalizeSetup({
    registration,
    dfmUrl,
    dfmUsername,
    dfmPassword,
    nifi1Url,
    nifi1Username,
    nifi1Password,
    nifi2Url,
    nifi2Username,
    nifi2Password,
    registryUrl,
    registrationId,
  }) {
    await registration.update({ infra_setup_done: true });
    console.log('TO', registration.email, this.mailService);
    await this.mailService.sendInstanceReadyMail({
      to: registration.email,
      username: registration.dataValues.name,
      dfmUrl,
      dfmUsername,
      dfmPassword,
      nifi1Url,
      nifi1Username,
      nifi1Password,
      nifi2Url,
      nifi2Username,
      nifi2Password,
      registryUrl,
      registrationId,
      registration,
    });

    logger.info('Email sent after infra setup', {
      email: registration.email,
      dfmUrl,
    });

    new TrialReminderService();
  }
}
