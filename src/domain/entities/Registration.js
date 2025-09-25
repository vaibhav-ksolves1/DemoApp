export default class Registration {
  constructor({ organisation_name, name, designation, email }) {
    console.log('CC', organisation_name);
    this.organisation_name = organisation_name;
    this.name = name;
    this.designation = designation;
    this.email = email;
  }
}

module.exports = Registration;
