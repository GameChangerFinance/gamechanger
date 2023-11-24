/* eslint-env mocha */
/* eslint-disable quotes */
/* global chai, gc */

mocha.setup({
  ui: 'bdd'
})

describe('unit tests', () => {
  const { expect /*, assert*/ } = chai

  describe('Dependencies Test', () => {
    it('should load dependencies', async () => {
      const res = await gc.utils._testDeps()
      expect(res).to.equal('OK')
    })
  })

  describe('Encoders Unit tests', () => {
    it('should build the correct APIv1 url using json-url-lzw', async () => {
      const url = await gc.encode.url({
        apiVersion: '1',
        network: 'mainnet',
        encoding: 'json-url-lzw',
        input: `{
          "type": "tx",
          "title": "APIv1 syntax Demo",
          "description": "created with gamechanger-dapp-cli",
          "metadata": {
            "123": {
              "message": "Hello World!"
            }
          }
        }`
      })
      const expectedUrl =
        'https://wallet.gamechanger.finance/api/1/tx/woTCpHR5cGXConR4wqV0aXRsZcKxQVBJdjEgc3ludGF4IERlbW_Cq2Rlc2NyaXDEim9uw5khxKVlYXRlZCB3xItoIGdhbWVjaGFuZ2VyLWRhcHAtY2xpwqjEu8SZxYXEmcKBwqMxMjPCgcKnxLtzc2HFgcKsSGVsbG8gV29ybGQh'
      console.dir({ expectedUrl, url })
      expect(url).to.equal(expectedUrl)
    })
    it('should build the correct APIv2 url using gzip', async () => {
      const url = await gc.encode.url({
        apiVersion: '2',
        network: 'mainnet',
        encoding: 'gzip',
        input: `{
          "type": "script",
          "title": "Share your public key information?",
          "description": "This dapp connection will ask your spending and staking public key hashes",
          "exportAs": "data",
          "return": {
              "mode": "last"
          },
          "run": {
              "getSpendCredential": {
                  "type": "getSpendingPublicKey"
              },
              "getStakeCredential": {
                  "type": "getStakingPublicKey"
              },
              "finally": {
                  "type": "macro",
                  "run": {
                      "spend": "{get('cache.getSpendCredential.pubKeyHashHex')}",
                      "stake": "{get('cache.getStakeCredential.pubKeyHashHex')}"
                  }
              }
          }
      }`
      })
      const expectedUrl =
        'https://beta-wallet.gamechanger.finance/api/2/run/1-H4sIAAAAAAAAA3WQQWoDMQxFryK8SQolB-gmlG4C3RTSC6i2Eovx2MbW0AzD3L3yTFsS0nplf-k_fXkyMmYyT6bawlnMoxGW0ISjx0IwpqFAHj4CW-hoBI6nVHoUTnGvzY5Wnz7V8u65gsOcwaYYyTYZPjkEwNqtqJopOo5nwOigCnbtfsX3WD1VJdMlpyLPVbEOBVUpJEPRMZPpk2sJA1YxsxaGRT2THBv9pZCjKIyhqd_r_RR13Nsy7ZXG5m26pqB_TWvEG8-JI4YwXjX2aEsyv0mWJVWeFLDdWLSedvfpdrq2Eg-68YEum4dZAe1H6A_nbcR756znC6FNzx7LAQAA'
      console.dir({ expectedUrl, url })
      expect(url).to.equal(expectedUrl)
    })

    it('should build the correct APIv2 url using json-url-lzma', async () => {
      const url = await gc.encode.url({
        apiVersion: '2',
        network: 'mainnet',
        encoding: 'json-url-lzma',
        input: `{
          "type": "script",
          "title": "Share your public key information?",
          "description": "This dapp connection will ask your spending and staking public key hashes",
          "exportAs": "data",
          "return": {
              "mode": "last"
          },
          "run": {
              "getSpendCredential": {
                  "type": "getSpendingPublicKey"
              },
              "getStakeCredential": {
                  "type": "getStakingPublicKey"
              },
              "finally": {
                  "type": "macro",
                  "run": {
                      "spend": "{get('cache.getSpendCredential.pubKeyHashHex')}",
                      "stake": "{get('cache.getStakeCredential.pubKeyHashHex')}"
                  }
              }
          }
      }`
      })
      const expectedUrl =
        'https://beta-wallet.gamechanger.finance/api/2/run/XQAAAAKVAQAAAAAAAABDKQqHk62WwfAiBV3_OkZJTid7YCcCmNLQij10bXq5AHYAodLZe51SeOhNCrZ3RwTE1fNhSfJ2etHQV5Qp9Gk3BJpBKaBTTSgqhjP6iOHRK8eKIDPOdmvynt3Yc4FXY2jcOAT75E02R1iPKgU41UCXUTCBD_DR0LNj-TCfO4Z3L2GCkjdONhnYS4LPDiys_XCu6EUhut5aL8JmgmOpgT6w1QrktIbpRKuJTz9989sHkxOxuFjo33TjCrDV0E-IFhxUOh7sJUTPhGTaz88gMx3fGhLvyNl_spcoTDaAhCJQqGyAHcBTFkeU9z5792DlwAb-ah9JDSyPBHX9mrzB'
      console.dir({ expectedUrl, url })
      expect(url).to.equal(expectedUrl)
    })

    it('should build the correct APIv2 QR for a dummy script', async () => {
      const qr = await gc.encode.qr({
        apiVersion: '2',
        network: 'mainnet',
        encoding: 'gzip',
        input: `{
          "type": "script",
          "title": "Share your public key information?",
          "description": "This dapp connection will ask your spending and staking public key hashes",
          "exportAs": "data",
          "return": {
              "mode": "last"
          },
          "run": {
              "getSpendCredential": {
                  "type": "getSpendingPublicKey"
              },
              "getStakeCredential": {
                  "type": "getStakingPublicKey"
              },
              "finally": {
                  "type": "macro",
                  "run": {
                      "spend": "{get('cache.getSpendCredential.pubKeyHashHex')}",
                      "stake": "{get('cache.getStakeCredential.pubKeyHashHex')}"
                  }
              }
          }
      }`
      })
      console.dir({ qr })
      expect(qr).not.to.be.empty
    })
  })
})

mocha.run()
