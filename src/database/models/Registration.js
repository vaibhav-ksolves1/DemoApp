// src/database/models/Registration.js

import { DataTypes, Model } from 'sequelize';
import sequelize from '../../shared/db.js'; // path to your shared sequelize instance


class Registration extends Model {}

Registration.init(
  {
    organisation_name: { type: DataTypes.STRING, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    designation: { type: DataTypes.STRING },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
  },
  {
    sequelize,
    modelName: 'Registration',
    tableName: 'registrations',
    // Enable automatic timestamps
    timestamps: true,
    // Rename default timestamp fields
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

export default Registration;
