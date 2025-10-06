import createDfmClient from '../../shared/axios/dfmClient.js';
import { delay, logger } from '../../shared/index.js';
import { DfmService } from './dfm/dfmSetup.js';

export async function bootstrap({ dfmUrl, nifiUrl1, nifiUrl2, registryUrl }) {
  try {
    logger.info('Bootstrapping DFM at :dfmUrl', { dfmUrl });
    const dfmClient = createDfmClient(dfmUrl);
    const dfmService = new DfmService({ dfmUrl, dfmClient });

    await delay(155000);

    logger.info('Setting up the DFM app');
    // Login & get token (automatically stored in dfmService)
    await dfmService.login();

    // Create registry
    const registryId = await dfmService.createRegistry({ registryUrl });

    // Create clusters
    await dfmService.createCluster({
      nifiUrl: nifiUrl1,
      clusterName: 'Development',
      registryId,
    });

    await dfmService.createCluster({
      nifiUrl: nifiUrl2,
      clusterName: 'Production',
      registryId,
    });
  } catch (err) {
    logger.error('Error bootstrapping DFM', { error: err });
    throw err;
  }
}
