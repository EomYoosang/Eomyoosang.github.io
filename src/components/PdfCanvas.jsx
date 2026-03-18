import { useEffect, useRef, useState } from 'react';

function useElementWidth(enabled) {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const element = ref.current;

    if (!element) {
      return undefined;
    }

    const updateWidth = () => {
      setWidth(element.getBoundingClientRect().width);
    };

    updateWidth();

    const observer = new ResizeObserver(() => {
      updateWidth();
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, [enabled]);

  return [ref, width];
}

export default function PdfCanvas({
  pdf,
  pageNumber,
  fixedWidth = 0,
  className = '',
}) {
  const canvasRef = useRef(null);
  const [containerRef, measuredWidth] = useElementWidth(!fixedWidth);
  const targetWidth = fixedWidth || measuredWidth;

  useEffect(() => {
    if (!pdf || !targetWidth) {
      return undefined;
    }

    const canvas = canvasRef.current;

    if (!canvas) {
      return undefined;
    }

    const context = canvas.getContext('2d', { alpha: false });

    if (!context) {
      return undefined;
    }

    let isCancelled = false;
    let renderTask;

    const renderPage = async () => {
      const page = await pdf.getPage(pageNumber);

      if (isCancelled) {
        return;
      }

      const baseViewport = page.getViewport({ scale: 1 });
      const scale = targetWidth / baseViewport.width;
      const viewport = page.getViewport({ scale });
      const outputScale = window.devicePixelRatio || 1;

      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);

      renderTask = page.render({
        canvasContext: context,
        transform:
          outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0],
        viewport,
      });

      try {
        await renderTask.promise;
      } catch (error) {
        if (error?.name !== 'RenderingCancelledException') {
          throw error;
        }
      }
    };

    renderPage().catch((error) => {
      if (error?.name !== 'RenderingCancelledException') {
        console.error(error);
      }
    });

    return () => {
      isCancelled = true;
      renderTask?.cancel();
    };
  }, [pdf, pageNumber, targetWidth]);

  return (
    <div className={`pdf-canvas ${className}`.trim()} ref={containerRef}>
      <canvas ref={canvasRef} />
    </div>
  );
}
