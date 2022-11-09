import ee from "@google/earthengine";
import privateKey from "../private-key.json";

console.log("Authenticating Earth Engine API using private key...");
const promise = new Promise<typeof ee>((resolve) =>
  ee.data.authenticateViaPrivateKey(
    privateKey,
    () => {
      console.log("Authentication successful.");
      ee.initialize(
        null,
        null,
        () => {
          console.log("Earth Engine client library initialized.");
          resolve(ee);
        },
        (err) => {
          console.log(err);
          console.log(
            `Please make sure you have created a service account and have been approved.
Visit https://developers.google.com/earth-engine/service_account#how-do-i-create-a-service-account to learn more.`
          );
        }
      );
    },
    (err) => {
      console.log(err);
    }
  )
);

export default promise;
