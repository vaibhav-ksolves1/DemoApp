import RegistrationModel from '../db/models/RegistrationModel.js';
import RegistrationRepository from '../../domain/repositories/RegistrationRepository.js';

export default class RegistrationRepositorySequelize extends RegistrationRepository {
  async create(registration) {
    return RegistrationModel.create(registration);
  }

  async findByEmail(email) {
    return RegistrationModel.findOne({ where: { email } });
  }
}
