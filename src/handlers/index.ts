import encode from './encode'
import snippet from './snippet'
export default {
  encode,
  snippet
}

// import { ActionHandlerType} from '../types';

// import URLEncoder from './encode/url';
// import QREncoder  from './encode/qr';
// import ButtonEncoder  from './encode/button';
// import HtmlEncoder  from './encode/html';
// import ReactEncoder  from './encode/react';
// import ExpressEncoder  from './encode/express';
// export const actionsHandlerLoaders: ActionHandlerLoaderType = {
// 	encode: {
// 		'url': ()=>import(`./encode/url`).then(d=>d?.default),
// 		'qr' : ()=>import(`./encode/qr`) .then(d=>d?.default),
// 	},
// };
//export const handlers: ActionHandlerType = {
