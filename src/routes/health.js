import express from 'express';
import {
  asyncHandler,
  sendSuccessResponse,
} from '../shared/utils/responseHandler.js';
const router = express.Router();

router.get(
  '/',
  asyncHandler(async (req, res, next) => {
    await sendSuccessResponse({
      response: res,
      responseMessage: 'APP is running.',
      responseData: null,
    });
  })
);

export default router;
