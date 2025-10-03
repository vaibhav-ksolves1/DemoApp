import createDfmClient from '../../shared/axios/dfmClient.js';
import { delay } from '../../shared/index.js';
import {
  getLoginToken,
  createCluster,
  createRegistry,
  // associateCluster,
} from './dfm/dfmSetup.js';

export async function bootstrap({ dfmUrl, nifiUrl1, nifiUrl2, registryUrl }) {
  const dfmClient = createDfmClient(dfmUrl);

  console.log('Waiting for 105 s....');
  await delay(105000);

  const dfmToken = await getLoginToken({ dfmUrl, dfmClient });
  const registryId = await createRegistry({
    dfmUrl,
    registryUrl,
    token: dfmToken,
    dfmClient,
  });
  await createCluster({
    dfmUrl,
    nifiUrl: nifiUrl1,
    clusterName: 'Development',
    token: dfmToken,
    registryId,
    dfmClient,
  });
  await createCluster({
    dfmUrl,
    nifiUrl: nifiUrl2,
    clusterName: 'Production',
    token: dfmToken,
    registryId,
    dfmClient,
  });
  // await createCluster({
  //   dfmUrl,
  //   nifiUrl,
  //   clusterName: 'Staging',
  //   token: dfmToken,
  //   dfmClient,
  // });
  // await associateCluster({
  //   dfmUrl,
  //   nifiUrl,
  //   registryUrl,
  //   token: dfmToken,
  //   dfmClient,
  // });
}
