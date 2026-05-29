import { useEffect, useRef, useState } from 'react';

function useElementWidth(ref, enabled) {
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

  return width;
}

function useLazyRender(ref) {
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    const element = ref.current;

    if (!element) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldRender(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '900px 0px',
      },
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [ref]);

  return shouldRender;
}

export default function PdfCanvas({
  pdf,
  pageNumber,
  fixedWidth = 0,
  className = '',
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [hasRendered, setHasRendered] = useState(false);
  const [pageMetrics, setPageMetrics] = useState(null);
  const [linkRegions, setLinkRegions] = useState([]);
  const measuredWidth = useElementWidth(containerRef, !fixedWidth);
  const shouldRender = useLazyRender(containerRef);
  const targetWidth = fixedWidth || measuredWidth;

  useEffect(() => {
    if (!pdf || !pageNumber) {
      return undefined;
    }

    setHasRendered(false);
    setPageMetrics(null);
    setLinkRegions([]);
  }, [pageNumber, pdf]);

  useEffect(() => {
    if (!shouldRender || !pdf || !targetWidth) {
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
      const displayWidth = Math.floor(viewport.width);
      const displayHeight = Math.floor(viewport.height);

      setPageMetrics({
        width: displayWidth,
        height: displayHeight,
      });

      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;

      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);

      const annotationsPromise = page
        .getAnnotations({ intent: 'display' })
        .catch(() => []);

      renderTask = page.render({
        canvasContext: context,
        transform:
          outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0],
        viewport,
      });

      try {
        const [annotations] = await Promise.all([
          annotationsPromise,
          renderTask.promise,
        ]);

        if (!isCancelled) {
          setLinkRegions(
            annotations
              .filter(
                (annotation) =>
                  annotation.subtype === 'Link' &&
                  (annotation.url || annotation.unsafeUrl),
              )
              .map((annotation) => {
                const [x1, y1, x2, y2] = viewport.convertToViewportRectangle(
                  annotation.rect,
                );

                return {
                  id: annotation.id,
                  href: annotation.url || annotation.unsafeUrl,
                  label:
                    annotation.contentsObj?.str ||
                    annotation.url ||
                    annotation.unsafeUrl,
                  left: Math.min(x1, x2),
                  top: Math.min(y1, y2),
                  width: Math.abs(x2 - x1),
                  height: Math.abs(y2 - y1),
                };
              }),
          );
          setHasRendered(true);
        }
      } catch (error) {
        if (error?.name !== 'RenderingCancelledException') {
          throw error;
        }
      } finally {
        page.cleanup();
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
  }, [pdf, pageNumber, shouldRender, targetWidth]);

  return (
    <div className={`pdf-canvas ${className}`.trim()} ref={containerRef}>
      {!hasRendered ? (
        <div className="pdf-canvas__placeholder" aria-hidden="true">
          <div className="pdf-canvas__spinner" />
        </div>
      ) : null}
      <div
        className="pdf-canvas__sheet"
        style={
          pageMetrics
            ? {
                width: `${pageMetrics.width}px`,
                height: `${pageMetrics.height}px`,
              }
            : undefined
        }
      >
        <canvas
          ref={canvasRef}
          className={hasRendered ? 'pdf-canvas__surface pdf-canvas__surface--ready' : 'pdf-canvas__surface'}
        />
        {hasRendered && linkRegions.length ? (
          <div className="pdf-canvas__links">
            {linkRegions.map((link) => (
              <a
                key={link.id}
                className="pdf-canvas__link"
                href={link.href}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={link.label}
                title={link.label}
                style={{
                  left: `${link.left}px`,
                  top: `${link.top}px`,
                  width: `${link.width}px`,
                  height: `${link.height}px`,
                }}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
