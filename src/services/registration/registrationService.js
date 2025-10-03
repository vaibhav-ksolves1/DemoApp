import { Op } from 'sequelize';

import { ClientError } from '../../shared/errors/customErrors.js';
import TerraformService from '../terraform/terraformService.js';

import { logger, prepareMessage } from '../../shared/index.js';

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

  // Fetch all failed registrations
  async getFailedRegistrations() {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

    const failedRegs = await this.registrationRepo.findAllWhere({
      infra_setup_done: false,
      created_at: {
        [Op.gte]: fifteenMinutesAgo,
      },
    });

    return failedRegs;
  }

  // Delete multiple registrations by email
  async deleteRegistrationsByEmails(emails) {
    if (!Array.isArray(emails) || emails.length === 0) {
      throw new ClientError('Emails array is required');
    }

    const deletedCount = await this.registrationRepo.deleteByEmails(emails);

    return {
      count: deletedCount,
    };
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
