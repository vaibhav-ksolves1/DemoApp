import express from 'express';
const router = express.Router();

router.get('/', (req, res) => {
  return sendSuccessResponse({
    response: res,
    responseMessage: 'APP is running.',
    responseData: null,
  });
});

export default router;
