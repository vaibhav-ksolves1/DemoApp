import { DataTypes } from 'sequelize';
import sequelize from '../database.js'; // adjust path if needed

const Registration = sequelize.define('Registration', {
  organisation_name: { type: DataTypes.STRING, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  designation: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
});

export default Registration;
