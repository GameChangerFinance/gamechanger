// import { GCDappConnUrls } from '../../config'
import { GCDomains, contact, apiEncodings } from '../../config'
import {
  APIEncoding,
  APIVersion,
  DefaultAPIVersion,
  DefaultNetwork,
  NetworkType,
  QRTemplateType
} from '../../types'
import { validateBuildMsgArgs } from '../../utils'
// import urlEncoder from '../../encodings/url'

const AstonMaartenTemplate = (args: {
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
  const strProp = (str?: string) =>
    str === undefined ? 'undefined' : JSON.stringify(str)

  const origin =
    GCDomains[args?.apiVersion || DefaultAPIVersion][
      args?.network || DefaultNetwork
    ]
  const gcscript = JSON.parse(args?.input)
  const _title = gcscript?.title || 'Cardano HTML5 Dapp Boilerplate'
  const _description =
    gcscript?.description ||
    `Cardano HTML5 Dapp Boilerplate, created with ${
      isNode ? 'gamechanger-cli' : 'gamechanger lib'
    }. Using Aston Maarten template.`
  const cfg = {
    domain: origin,
    apiDocRelBasePath: 'doc/api/v2',
    contact
  }
  const encodings = apiEncodings[args?.apiVersion || DefaultAPIVersion]
  const returnURLTip =
    args?.apiVersion === '2'
      ? `//Head to ${cfg.domain}${cfg.apiDocRelBasePath}/api.html#returnURLPattern to learn ways how to customize this URL`
      : ''

  return `
<!DOCTYPE html>
<html lang="en">

<head>
<title>${_title}</title>
<meta name="title" content="${_title}">
<meta name="description" content="${_description}">

<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="theme-color" content="#6d41a1" />

<script src='dist/browser.min.js'></script>
<!--<script src='https://cdn.jsdelivr.net/npm/@gamechanger-finance/gc/dist/browser.min.js'></script>-->

<script>
  let handleSetEncoder;

  ///////////////////////////
  ////    Dapp Logic    /////
  ///////////////////////////
  async function main() {
      // import gc from '@gamechanger-finance/gc'
      const {gc} = window;

      //Dapp <--> GameChanger Wallet connections can use URL redirections
      let   actionUrl   = "";
      let   resultObj   = undefined;
      let   error       = ""; 
      let   useCodec    = ${strProp(args?.encoding)};

      //GameChanger Wallet is pure Web3, zero backend procesing of user data. 
      //Dapp connector links are fully processed on end-user browsers.
      const currentUrl  = window.location.href;

      //UI components:
      const connectForm = document.getElementById("dappConnectorBox");
      const actionBtn   = document.getElementById("connectBtn");
      const errorsBox   = document.getElementById("errorBox");
      const resultsBox  = document.getElementById("resultBox");
      const encodersBox = document.getElementById("encodersBox");

      //here we register a function to change connection encoding/compression
      handleSetEncoder=(codec)=>{
          useCodec=codec;
          updateUI();
          return false;
      }
      async function updateUI() {
          error="";
          actionUrl="";


          //GameChanger Wallet support arbitrary data returning from script execution, encoded in a redirect URL
          ${returnURLTip}

          //lets try to capture the execution results by decoding/decompressing the return URL
          try{                
              const resultRaw   = (new URL(currentUrl)).searchParams.get("result");
              if(resultRaw){
                  resultObj     = await gc.encodings.msg.decoder(resultRaw);
                  //avoids current url carrying latest results all the time 
                  history.pushState({}, '', window.location.pathname);
              }
          }catch(err){
              error+=\`Failed to decode results.\${err?.message||"unknown error"}\`;
              console.error(err);
          }


          //This is the GCScript code, packed into a URL, that GameChanger Wallet will execute
          //lets try to generate this connection URL by encoding/compressing the gcscript code
          try{                
              //GCScript (dapp connector code) will be packed inside this URL    
              actionUrl   = await buildActionUrl(); 
          }catch(err){
              error+=\`Failed to build URL.\${err?.message||"unknown error"}\`
              console.error(err);
          }
          
          //Now lets render the current application state
          if(error){
              errorBox.innerHTML="Error: " + error;
          }
          if(actionUrl){
              errorBox.innerHTML="";
              actionBtn.href=actionUrl;
              actionBtn.innerHTML = \`Connect\`;
          }else{
              actionBtn.href      = '#';
              actionBtn.innerHTML = "Loading...";
          }

          if(resultObj){
              resultsBox.innerHTML=JSON.stringify(resultObj,null,2);
          }
          encodersBox.innerHTML="Encoding: "
          encodersBox.innerHTML+=${JSON.stringify(encodings)}
              .map(codec=>\`<a href="#" class="a-unstyled" \${codec===useCodec?'style="font-weight:bold;""':''} onclick="return handleSetEncoder('\${codec}')">\${codec}</a>\`)
              .join(" | ");               

      }

      async function buildActionUrl(args){
          //This is the GCScript code that GameChanger Wallet will execute
          //JSON code that will be encoded/compressed inside 'actionUrl'
          var gcscript = ${args.input};
          //This is a patch to adapt the return URL of the script to the origin that is hosting this html file.
          //so this way executed scripts data exports can be captured back on dapp side
          gcscript.returnURLPattern  = window.location.origin +  window.location.pathname ;
          const url=await gc.encode.url({
            input:JSON.stringify(gcscript),
            apiVersion:${strProp(args?.apiVersion)},
            network:${strProp(args?.network)},
            encoding:useCodec,
          });
          return url;
      }

      updateUI();
  }


  window.onload = function () {
      main();
  }

</script>

<style>
  body {
      background: fixed;
      background-image: linear-gradient(to left top, #097790, #006c8a, #006184, #00567c, #0b4b74, #184878, #26457b, #35417c, #514187, #6f3e8d, #8d378e, #ab2b89);
      font-family: Arial, Helvetica, sans-serif;
      color: rgb(222, 222, 222);
      text-align: center;
      margin: 12px;
  }

  .box {
      background: #332f39;
      margin: auto;
      padding: 30px;
      border: thin solid black;
      border-radius: 30px;
      box-shadow: 0 1px 1px rgba(0,0,0,0.11), 
        0 2px 2px rgba(0,0,0,0.2), 
        0 4px 4px rgba(0,0,0,0.2), 
        0 8px 8px rgba(0,0,0,0.2), 
        0 16px 16px rgba(0,0,0,0.2), 
        0 32px 32px rgba(0,0,0,0.15);
      max-width: 600px;
  }

  a:link {
      color: rgb(174, 47, 174);
  }

  /* visited link */
  a:visited {
      color: rgb(76, 122, 171);
  }

  /* mouse over link */
  a:hover {
      color: rgb(203, 64, 215);
  }

  /* selected link */
  a:active {
      color: blue;
  }
  #errorBox{
      color: #f58000;
      font-weight: bold;
  }
  .console {
      overflow: auto;
      text-align: left;
      background-color: rgb(30, 30, 30);
      color: green;
      min-height: 200px;
      padding: 8px;
      border-radius: 5px;
      box-shadow: inset 0 1px 1px rgba(0,0,0,0.11), 
      inset 5px 2px 2px 2px rgba(0,0,0,0.2), 
      inset 5px 4px 4px rgba(0,0,0,0.2), 
      inset  0 8px 8px rgba(0,0,0,0.2), 
      inset   0 16px 16px rgba(0,0,0,0.2), 
      inset  0 32px 32px rgba(0,0,0,0.15);
  }

  .flexrow {
      display: flex;
      justify-content: center;
      gap: 8px;
      margin: 10px;
  }

  form{
      width: 100%;
  }
  .a-unstyled, .a-unstyled > *{
      color: inherit;
      text-decoration: none; 
  }
  .a-unstyled:link { color: inherit;text-decoration: none; }
  .a-unstyled:visited { color: inherit;text-decoration: none; }
  .a-unstyled:hover { color: inherit;text-decoration: none; }
  .a-unstyled:active { color: inherit;text-decoration: none; }
  .button {
      display:inline-block;
      background-color: #181818;
      color: rgb(222, 222, 222);
      border: thin solid white;
      width: 100%;
      margin: 10px 0px;
      padding-top: 20px;
      padding-bottom: 20px;
      font-size: 20px;
      font-weight: bold;
      border-radius: 10px;
      cursor: pointer;
      box-shadow: 0 1px 1px rgba(0,0,0,0.11), 
        0 2px 2px rgba(0,0,0,0.2), 
        0 4px 4px rgba(0,0,0,0.2), 
        0 8px 8px rgba(0,0,0,0.2), 
        0 16px 16px rgba(0,0,0,0.11);
      background-color:#734cad60;
  }
  .button:hover {
      background:linear-gradient(to bottom, #734cad 5%, #644b8a 100%);
      background-color:#734cad;
  }
  .button:active {
      position:relative;
      top:1px;
  }

  /* ===== Scrollbar CSS ===== */
  /* Firefox */
  * {
      scrollbar-width: 10px!important;
      scrollbar-color: gray rgb(30, 30, 30,0);
  }

  /* Chrome, Edge, and Safari */
  *::-webkit-scrollbar {
      width: 10px!important;
  }

  *::-webkit-scrollbar-track {
      background: rgb(30, 30, 30,0);
  }

  *::-webkit-scrollbar-thumb {
      background-color: gray;
      border-radius: 10px;
      border: 3px solid rgb(30, 30, 30,0);
  }
</style>
</head>

<body>
<div class="box">
  <h1>${_title}</h1>
  <p><i>${_description}</i></p>
   
      <div id="dappConnectorBox">
          <a href="#" id="connectBtn" class="button a-unstyled">
              Loading....
          </a>
      </div>

  <pre id="errorBox"  class="errors"></pre>
  <pre id="resultBox" class="console">Results will appear here after you connect with the wallet</pre>

  <pre id="encodersBox"></pre>

  <h6><i> 💪 Lets turn Cardano into the Blockchain of the Web! 💪 </i> </h6>

  <i>Generated with ❤️ 
  <br/>
  by <b>
      <a target="_blank" rel="noopener noreferrer" href="${origin}playground"> GameChanger Wallet Playground IDE</a>
  </b>
  <br/>
   2023 </i>

  <h6 class="flexrow">
      <a target="_blank" rel="noopener noreferrer" href="${
        cfg.contact.twitter
      }">Twitter News</a> 
      <a target="_blank" rel="noopener noreferrer" href="${
        cfg.contact.discord
      }">Discord Support</a> 
      <a target="_blank" rel="noopener noreferrer" href="${
        cfg.contact.youtube
      }">Youtube Tutorials</a>            
      <a target="_blank" rel="noopener noreferrer" href="${
        cfg.contact.github
      }">Github Docs and examples</a>            
      <a target="_blank" rel="noopener noreferrer" href="${
        cfg.contact.website
      }">Website</a>
  </h6>
</div>
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

    const text = AstonMaartenTemplate({
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
