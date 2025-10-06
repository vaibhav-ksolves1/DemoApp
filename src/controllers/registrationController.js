import RegistrationService from '../services/registration/registrationService.js';
import {
  sendSuccessResponse,
  asyncHandler,
} from '../shared/utils/responseHandler.js';

import RegistrationRepository from '../repositories/registrationRepository.js';
import { resMessages } from '../shared/constants/index.js';
import { prepareMessage } from '../shared/index.js';

export default class RegistrationController {
  constructor() {
    const registrationRepo = new RegistrationRepository();
    this.registrationService = new RegistrationService(registrationRepo);
  }

  // Register a new user
  register = asyncHandler(async (req, res, next) => {
    const registration = await this.registrationService.register(req.body);
    return sendSuccessResponse({
      response: res,
      responseMessage: resMessages.REGISTRATION_SUCCESS,
      responseData: registration,
    });
  });

  // Get all failed registrations
  getFailedRegistrations = asyncHandler(async (req, res) => {
    const failedRegs = await this.registrationService.getFailedRegistrations();
    return sendSuccessResponse({
      response: res,
      responseData: failedRegs,
    });
  });

  // Delete a failed registration by ID
  deleteFailedRegistration = asyncHandler(async (req, res) => {
    const { emails } = req.body;
    const { count } =
      await this.registrationService.deleteRegistrationsByEmails(emails);
    return sendSuccessResponse({
      response: res,
      responseMessage: prepareMessage(
        resMessages.REGISTRATION_DELETED_WITH_COUNT,
        {
          count,
        }
      ),
      count,
    });
  });
}
