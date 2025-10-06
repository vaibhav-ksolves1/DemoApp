import axios from 'axios';

/**
 * Create an Axios instance for DFM API
 * @param {string} baseURL - The base URL for the DFM server
 * @returns {AxiosInstance}
 */
const createDfmClient = baseURL => {
  const client = axios.create({
    baseURL: baseURL,
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // // Request interceptor: attach token if available
  // client.interceptors.request.use(
  //   config => {
  //     const token = process.env.DFM_API_TOKEN; // or dynamically pass token
  //     if (token) {
  //       config.headers.Authorization = `Bearer ${token}`;
  //     }
  //     console.log('Sending request to:', config.url);
  //     return config;
  //   },
  //   error => Promise.reject(error)
  // );

  // // Response interceptor: log & handle errors globally
  // client.interceptors.response.use(
  //   response => response.data,
  //   error => {
  //     console.error('API error:', error.response?.status, error.message);
  //     return Promise.reject(error);
  //   }
  // );

  return client;
};

export default createDfmClient;
