import { ClientError } from '../../shared/errors/customErrors.js';
import TerraformService from '../terraform/terraformService.js';

import { logger } from '../../shared/index.js';

export default class RegistrationService {
  constructor(registrationRepo) {
    this.registrationRepo = registrationRepo;
    this.terraformService = new TerraformService();
  }

  async register({ organisation_name, name, designation, email }) {
    // Check duplicate email
    const existing = await this.registrationRepo.findByEmail(email);
    if (existing) throw new ClientError('Email already registered');

    // Create registration in DB
    const registration = await this.registrationRepo.create({
      organisation_name,
      name,
      designation,
      email,
    });

    // Fire-and-forget Terraform provisioning
    this._provisionInfraAsync(registration.id);

    return registration; // immediate response
  }

  async getUser(id) {
    const user = await this.registrationRepo.findById(id);
    if (!user) throw new Error('User not found');
    return user;
  }

  // private method to run Terraform asynchronously
  async _provisionInfraAsync(registrationId) {
    try {
      const url = await this.terraformService.provisionInfrastructure(
        registrationId
      );
      logger.info(`Infra provisioned for ${registrationId}: ${url}`);
    } catch (err) {
      // logger.error(`Terraform provisioning failed for ${registrationId}`, err);
    }
  }
}
