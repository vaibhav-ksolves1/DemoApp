import Registration from '../database/models/Registration.js';

export default class RegistrationRepository {
  async create(data) {
    return Registration.create(data);
  }

  async findByEmail(email) {
    return Registration.findOne({ where: { email } });
  }

  async findById(id) {
    return Registration.findByPk(id);
  }

  async update(id, updates) {
    return Registration.update(updates, { where: { id }, returning: true });
  }
}
