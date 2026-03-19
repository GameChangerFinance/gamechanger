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
    it('should build a valid APIv2 url using gzip and append networkTag by default', async () => {
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
      const parsed = new URL(url)
      expect(parsed.searchParams.get('networkTag')).to.equal('mainnet')
      expect(parsed.pathname).to.match(/\/api\/2\/run\//)
    })

    it('should preserve existing query params and append handler specific params', async () => {
      const url = await gc.encodings.url.encoder(
        { hello: 'world' },
        {
          urlPattern: 'https://example.test/run/{gcscript}?existing=1',
          encoding: 'gzip',
          queryParams: {
            networkTag: 'preprod',
            ref: 'addr_test1example'
          }
        }
      )
      const parsed = new URL(url)
      expect(parsed.searchParams.get('existing')).to.equal('1')
      expect(parsed.searchParams.get('networkTag')).to.equal('preprod')
      expect(parsed.searchParams.get('ref')).to.equal('addr_test1example')
    })

    it('should support refAddress and disableNetworkRouter in handlers', async () => {
      const url = await gc.encode.url({
        apiVersion: '2',
        network: 'preprod',
        encoding: 'gzip',
        refAddress: 'addr_test1vr3example',
        disableNetworkRouter: true,
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
              }
          }
      }`
      })
      const parsed = new URL(url)
      expect(parsed.searchParams.get('ref')).to.equal('addr_test1vr3example')
      expect(parsed.searchParams.get('networkTag')).to.equal(null)
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
