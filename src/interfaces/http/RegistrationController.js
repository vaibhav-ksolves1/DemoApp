export default class RegistrationController {
  constructor(registerUser) {
    this.registerUser = registerUser;
  }

  async register(req, res) {
    try {
      const registration = await this.registerUser.execute(req.body);
      res.json({ success: true, registration });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  }
}
