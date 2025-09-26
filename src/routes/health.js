import express from 'express';
const router = express.Router();

router.get('/', (req, res) => {
  // res.status(200).json({ status: 'ok', message: 'API is healthy' });
  return sendSuccessResponse({
    response: res,
    responseMessage: 'API is healthy',
    responseData: null,
  });
});

export default router;
