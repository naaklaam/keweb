/*
 * Safari and Edge polyfill for createImageBitmap
 * https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/createImageBitmap
 *
 * Support source image types Blob and ImageData.
 *
 * From: https://dev.to/nektro/createimagebitmap-polyfill-for-safari-and-edge-228
 * Updated by Yoan Tournade <yoan@ytotech.com>
 */
if (!('createImageBitmap' in window)) {
	  window.createImageBitmap = async function (data) {
		    return new Promise((resolve,reject) => {
			      let dataURL;
			      if (data instanceof Blob) {
				        dataURL = URL.createObjectURL(data);
			      } else if (data instanceof ImageData) {
				        const canvas = document.createElement('canvas');
				        const ctx = canvas.getContext('2d');
				        canvas.width = data.width;
				        canvas.height = data.height;
				        ctx.putImageData(data,0,0);
				        dataURL = canvas.toDataURL();
			      } else {
				        throw new Error('createImageBitmap does not handle the provided image source type');
			      }
			      const img = document.createElement('img');
			      img.addEventListener('load',function () {
				        resolve(this);
			      });
			      img.src = dataURL;
		    });
	  };
}

if (!('dynamicImport' in globalThis)) {
  globalThis.dynamicImport = function(uri) {
    return import(uri);
  }
};

var global = globalThis;

/*
  MIT License

Copyright (c) 2021 Tobias Buschor

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

// Polyfill for `scrollIntoViewIfNeeded` function not existing in Firefox.
// https://github.com/nuxodin/lazyfill


;(function() {
  if (!Element.prototype.scrollIntoViewIfNeeded) {
    Element.prototype.scrollIntoViewIfNeeded = function ( centerIfNeeded = true ) {
      const el = this;
      new IntersectionObserver( function( [entry] ) {
        const ratio = entry.intersectionRatio;
        if (ratio < 1) {
          let place = ratio <= 0 && centerIfNeeded ? 'center' : 'nearest';
          el.scrollIntoView( {
            block: place,
            inline: place,
          } );
        }
        this.disconnect();
      } ).observe(this);
    };
  }
})()
