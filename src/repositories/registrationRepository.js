import { Op } from 'sequelize';

import Registration from '../database/models/Registration.js';

export default class RegistrationRepository {
  async create(data) {
    return Registration.create(data);
  }

  async update(id, updates) {
    return Registration.update(updates, { where: { id }, returning: true });
  }

  // Find by email
  async findByEmail(email) {
    return Registration.findOne({ where: { email } });
  }

  //  find with any where clause
  async findAllWhere(where) {
    return Registration.findAll({ where });
  }

  async deleteByEmails(emails) {
    return Registration.destroy({
      where: {
        email: {
          [Op.in]: emails,
        },
      },
    });
  }
}
