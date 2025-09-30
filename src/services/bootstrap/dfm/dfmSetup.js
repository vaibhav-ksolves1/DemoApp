/*
This file contains code for setting up clusters, registries, and their associations on DFM.
*/

import { name } from 'ejs';
import createDfmClient from '../../../shared/axios/dfmClient.js';

import { dfmEndpoint } from '../../../shared/constants/endpoints.js';

/**
 * Get DFM login token
 * @param {Object} param0
 * @param {string} param0.dfmUrl - DFM instance URL
 * @param {string} param0.email - User email
 * @param {string} param0.password - User password
 */
export const getLoginToken = async ({ dfmUrl, email, password, dfmClient }) => {
  const res = await dfmClient.post(`${dfmUrl}${dfmEndpoint.LOGIN}`, {
    email: email || process.env.DFM_DEFAULT_ADMIN_USER,
    password: password || process.env.DFM_DEFAULT_ADMIN_PASS,
  });
  return res.token; // should include token
};

/**
 * Create a cluster on DFM
 * @param {Object} payload - Cluster payload
 * @param {string} token - Bearer token
 */
export const createCluster = async input => {
  const { dfmUrl, nifiUrl, clusterName, token, registryId, dfmClient } = input;
  const payload = {
    name: clusterName,
    nifi_url: nifiUrl,
    registry_id: registryId,
    tag: '',
    notification_enable: false,
    approver_enable: false,
    start_stop_requires_approval: false,
    change_request_enable: false,
  };

  const res = await dfmClient.post(
    `${dfmUrl}${dfmEndpoint.ADD_CLUSTER}`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return res.data;
};

/**
 * Create a registry on DFM
 * @param {Object} payload - Registry payload
 * @param {string} token - Bearer token
 */
export const createRegistry = async input => {
  const { dfmUrl, token, dfmClient, registryUrl } = input;

  const payload = {
    name: 'Trial Registry',
    is_registry_authenticated: false,
    registry_url: registryUrl,
  };
  const res = await dfmClient.post(
    `${dfmUrl}${dfmEndpoint.ADD_REGISTRY}`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );
  return res.id;
};

// /**
//  * Associate a cluster with a registry
//  * @param {string} clusterId - Cluster ID
//  * @param {Object} payload - Association payload
//  * @param {string} token - Bearer token
//  */
// export const associateCluster = async (clusterId, payload, token) => {
//   const res = await dfmClient.post(
//     `/clusters/${clusterId}/associate`,
//     payload,
//     {
//       headers: {
//         Authorization: `Bearer ${token}`,
//         'Content-Type': 'application/json',
//       },
//     }
//   );
//   return res.data;
// };
