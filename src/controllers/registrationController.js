import RegistrationService from '../services/registration/registrationService.js';
import {
  sendSuccessResponse,
  sendErrorResponse,
  asyncHandler,
} from '../shared/utils/responseHandler.js';

import RegistrationRepository from '../repositories/registrationRepository.js';
export default class RegistrationController {
  constructor() {
    const registrationRepo = new RegistrationRepository();
    this.registrationService = new RegistrationService(registrationRepo);

    // Bind methods if used directly in routes
    this.register = this.register.bind(this);
    this.getUser = this.getUser.bind(this);
  }

  register = asyncHandler(async (req, res) => {
    const registration = await this.registrationService.register(req.body);
    return sendSuccessResponse({
      response: res,
      responseMessage: 'Registration successful',
      responseData: registration,
    });
  });

  getUser = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const user = await this.registrationService.getUser(id);
    return sendSuccessResponse({
      response: res,
      responseData: user,
    });
  });
}
