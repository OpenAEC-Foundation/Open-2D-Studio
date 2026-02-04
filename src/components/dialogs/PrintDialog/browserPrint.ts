export function printViaWindow(
  canvasDataUrl: string,
  copies: number,
  paperSize: string,
  orientation: string
): void {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-9999px';
  iframe.style.top = '-9999px';
  iframe.style.width = '0';
  iframe.style.height = '0';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    document.body.removeChild(iframe);
    return;
  }

  const cssSize = paperSize.toLowerCase().startsWith('a')
    ? paperSize
    : paperSize === 'Letter'
      ? '8.5in 11in'
      : paperSize === 'Legal'
        ? '8.5in 14in'
        : paperSize === 'Tabloid'
          ? '11in 17in'
          : 'auto';

  iframeDoc.open();
  iframeDoc.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        @page {
          size: ${cssSize} ${orientation};
          margin: 0;
        }
        html, body {
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
        }
        img {
          display: block;
          max-width: 100%;
          max-height: 100vh;
          width: auto;
          height: auto;
          object-fit: contain;
        }
        @media print {
          html, body {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
          }
          img {
            max-width: 100%;
            max-height: 100%;
            page-break-after: avoid;
            page-break-inside: avoid;
          }
        }
      </style>
    </head>
    <body>
      <img src="${canvasDataUrl}" />
    </body>
    </html>
  `);
  iframeDoc.close();

  iframe.onload = () => {
    setTimeout(() => {
      try {
        for (let i = 0; i < copies; i++) {
          iframe.contentWindow?.print();
        }
      } catch {
        window.print();
      }
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 250);
  };
}
