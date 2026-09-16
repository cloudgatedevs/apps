import assert from 'node:assert/strict';
import { test } from 'node:test';

for (const app of ['shop','pos','booking','jobs','courses','events']) {
  const { explainApiError } = await import(`../${app}/src/shared/services/api-error.js`);
  const { createCloudgateClient, CloudgateError } = await import(`../${app}/node_modules/@cloudgatedevs/cloudgate-client/src/index.js`);
  test(`${app}: real SDK errors retain the checkout explanation and HTTP metadata`, async () => {
    // The native engine uses PascalCase; IdP/ABP uses a nested camelCase envelope.
    for (const body of [
      {Data:null,HttpStatusCode:400,Message:'Configure your live HTTPS website URL before accepting payments.'},
      {error:{message:'The wallet cannot accept payments yet.'}},
    ]) {
      const client = createCloudgateClient({baseUrl:'https://gateway.example/sbx/app',fetch:async () => new Response(JSON.stringify(body),{status:400})});
      await assert.rejects(async () => {
        try { await client.post('/checkout',{}); } catch (error) { throw explainApiError(error); }
      }, error => error instanceof CloudgateError && error.status === 400 && error.message === (body.Message || body.error.message));
    }
  });
  test(`${app}: unexpected responses do not expose payloads or stack traces`, () => {
    for (const body of ['<html>Proxy failure</html>', {Message:'Traceback: private internals'}, {Data:{secret:'private'}}]) {
      const error=new CloudgateError('Cloudgate responded 400',{status:400,body});
      assert.equal(explainApiError(error).message,'Cloudgate responded 400');
    }
    const error=new Error('Connection interrupted');
    assert.equal(explainApiError(error),error);
  });
}
