export default class RegisterUser {
  constructor(registrationRepo, terraformService, mailService) {
    this.registrationRepo = registrationRepo;
    this.terraformService = terraformService;
    this.mailService = mailService;
  }

  async execute({ organisation_name, name, designation, email }) {
    // Check duplicate email
    const existing = await this.registrationRepo.findByEmail(email);
    if (existing) throw new Error('Email already registered');

    // Create registration
    const registration = await this.registrationRepo.create({
      organisation_name,
      name,
      designation,
      email,
    });

    // // Trigger terraform
    // const url = await this.terraformService.provisionInfrastructure(
    //   registration.id
    // );

    // // Send mail
    // await this.mailService.sendMail(
    //   email,
    //   'Your application is ready',
    //   `Access it here: ${url}`
    // );

    return registration;
  }
}
