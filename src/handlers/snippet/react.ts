// import { GCDappConnUrls } from '../../config'
import {
  APIEncoding,
  APIVersion,
  NetworkType,
  QRTemplateType
} from '../../types'
import { validateBuildMsgArgs } from '../../utils'
// import urlEncoder from '../../encodings/url'
const baseTemplate = (args: {
  apiVersion: APIVersion
  network: NetworkType
  encoding: APIEncoding
  input: string
  debug?: boolean

  qrResultType?: 'png' | 'svg'
  outputFile?: string
  template?: QRTemplateType | string
  styles?: string //JSON
}) => {
  const isNode = typeof process === 'object' && typeof window !== 'object'
  const title = 'Cardano React Dapp Boilerplate'
  const strProp = (str?: string) =>
    str === undefined ? 'undefined' : JSON.stringify(str)
  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset='UTF-8'>
    <title>${title}</title>
    <script src='https://unpkg.com/react@18.2.0/umd/react.production.min.js'></script>
    <script src='https://unpkg.com/react-dom@18.2.0/umd/react-dom.production.min.js'></script>
    <script src='https://unpkg.com/babel-standalone@6.26.0/babel.js'></script>
    <script src='dist/browser.min.js'></script>
    <!--<script src='https://cdn.jsdelivr.net/npm/@gamechanger-finance/gc/dist/browser.min.js'></script>-->

    <style>
    * { margin: 0; background: #334d56; color: #fff; }
    body { padding: 30px; box-sizing: content-box; }
    span { font-size: 50px; margin: 10px; }
    .centered { text-align: center; }
    .qrImage { height:65vh; }
    </style>
  </head>
  <body>
    <div id='root'></div>

    <script type='text/babel'>
      // import gc from '@gamechanger-finance/gc'
      const {gc} = window;

      const App=()=>{
        const _gcscript=${args.input};
        //This is a patch to adapt the return URL of the script to the origin that is hosting this html file.
        //so this way executed scripts data exports can be captured back on the hosted dapp
        _gcscript.returnURLPattern = \`\${window.location.origin + window.location.pathname}?result={result}\`;
        const [gcscript,setGCscript]=React.useState(_gcscript);
        const [url,setUrl]=React.useState('');
        const [qr,setQr]  =React.useState('');
        const [result,setResult]  =React.useState(null);

        React.useEffect(()=>{
          const currentUrl = new URL(window.location.href);
          const msg        = currentUrl.searchParams.get("result");

          if(msg){
            gc.encodings.msg.decoder(msg)
              .then(newResult=>{
                setResult(newResult);
                //avoids current url carrying latest results all the time
                window.history.pushState({}, '', window.location.pathname);
              })
              .catch(console.error)
          }

          gc.encode.url({
            input:JSON.stringify(gcscript),
            apiVersion:${strProp(args?.apiVersion)},
            network:${strProp(args?.network)},
            encoding:${strProp(args?.encoding)},
          })
            .then(newUrl=>setUrl(newUrl))
            .catch(console.error)

          gc.encode.qr({
            input:JSON.stringify(gcscript),
            apiVersion:${strProp(args?.apiVersion)},
            network:${strProp(args?.network)},
            encoding:${strProp(args?.encoding)},

            qrResultType:${strProp(args?.qrResultType)},
            outputFile:${strProp(args?.outputFile)},
            template:${strProp(args?.template)},
            styles:${strProp(args?.styles)},                        
          })
            .then(newQr=>setQr(newQr))
            .catch(console.error)

      },[gcscript]);

        return <div class="centered">
          <h1>${title}</h1>
          <br/>
          {result && <div>
            <h3>this is the response from the wallet:</h3>
            <pre style={{textAlign:"left"}}>{JSON.stringify(result,null,2)}</pre>
            <br/>
            <a href="#" onClick={()=>setResult(null)}><h2>Reset</h2></a>
          </div>}
          {!result && <div>
            <h3>connect with wallet by clicking on this link:</h3>
            <a href={url}><h2>Connect</h2></a>
            <br/><br/>
            <h3>or by scanning the QR code with wallet or mobile camera:</h3>
            <img class="qrImage" src={qr}/>
          </div>}
          <br/><br/>
          <i>Created with <a href="#">${
            isNode ? 'gamechanger-cli' : 'gamechanger lib'
          }</a></i>
        </div>
      }
      ReactDOM.render(<App />, document.querySelector('#root'));
    </script>
  </body>
</html>  
`
}

export default async (args: {
  apiVersion: APIVersion
  network: NetworkType
  encoding: APIEncoding
  input: string
  debug?: boolean

  qrResultType?: 'png' | 'svg'
  outputFile?: string
  template?: QRTemplateType | string
  styles?: string //JSON
}) => {
  try {
    const { apiVersion, network, encoding, input } = validateBuildMsgArgs(args)

    const text = baseTemplate({
      apiVersion,
      network,
      encoding,
      input,

      qrResultType: args?.qrResultType,
      outputFile: args?.outputFile,
      template: args?.template,
      styles: args?.styles
    })
    return `data:text/html;base64,${Buffer.from(text).toString('base64')}`
  } catch (err) {
    if (err instanceof Error)
      throw new Error('URL generation failed. ' + err?.message)
    else throw new Error('URL generation failed. ' + 'Unknown error')
  }
}
