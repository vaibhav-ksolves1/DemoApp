import { dfmEndpoint } from '../../../shared/constants/endpoints.js';

export class DfmService {
  constructor({ dfmUrl, dfmClient, email, password }) {
    this.dfmUrl = dfmUrl;
    this.dfmClient = dfmClient;
    this.email = email || process.env.DFM_DEFAULT_ADMIN_USER;
    this.password = password || process.env.DFM_DEFAULT_ADMIN_PASS;
    this.token = null;
  }

  async login() {
    const res = await this.dfmClient.post(
      `${this.dfmUrl}${dfmEndpoint.LOGIN}`,
      {
        email: this.email,
        password: this.password,
      }
    );
    this.token = res.token;
    return this.token;
  }

  async createCluster({ nifiUrl, clusterName, registryId }) {
    if (!this.token) throw new Error('Not authenticated. Call login() first.');

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

    const res = await this.dfmClient.post(
      `${this.dfmUrl}${dfmEndpoint.ADD_CLUSTER}`,
      payload,
      {
        headers: { Authorization: `Bearer ${this.token}` },
      }
    );

    return res.data;
  }

  async createRegistry({ registryUrl }) {
    if (!this.token) throw new Error('Not authenticated. Call login() first.');

    const payload = {
      name: 'Trial Registry',
      is_registry_authenticated: false,
      registry_url: registryUrl,
    };

    const res = await this.dfmClient.post(
      `${this.dfmUrl}${dfmEndpoint.ADD_REGISTRY}`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return res.id;
  }
}
