export const GCLibInSnippets = {
  browserExamples: `
<!-- Use for local deployments or for testing the library: -->
<script src="res/browser.min.js"></script>
<!-- Use library from CDN: -->
<!-- <script src="https://cdn.jsdelivr.net/npm/@gamechanger-finance/gc@latest/dist/browser.min.js"></script> -->
`,
  nodeJsExamples: `
//Install on project:
//  $ npm install -s @gamechanger-finance/gc
// or
//Install globally:
//  $ npm install -g @gamechanger-finance/gc
//Run this file
//  $ node <FILENAME>.js

//Import if testing the library from this repository:
import gc from './res/nodejs.js'
// or
//Import normally:
//import gc from '@gamechanger-finance/gc'
`
}
